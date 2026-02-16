<?php
// quotes.php - API لنظام عروض الأسعار
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// الاتصال بقاعدة البيانات
$host = 'localhost';
$dbname = 'armax_test';
$username = 'root'; // افتراضي في XAMPP
$password = ''; // فارغ افتراضياً في XAMPP

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'فشل الاتصال بقاعدة البيانات']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($method) {
    case 'POST':
        createQuote($pdo, $input);
        break;
    case 'GET':
        if (isset($_GET['number'])) {
            getQuote($pdo, $_GET['number']);
        } elseif (isset($_GET['search'])) {
            searchQuotes($pdo, $_GET['search']);
        } else {
            getAllQuotes($pdo);
        }
        break;
    case 'PUT':
        if (isset($_GET['id'])) {
            updateQuote($pdo, $_GET['id'], $input);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'معرف العرض مطلوب']);
        }
        break;
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteQuote($pdo, $_GET['id']);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'معرف العرض مطلوب']);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}

// إنشاء عرض سعر جديد
function createQuote($pdo, $data) {
    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("INSERT INTO quotes (
            quote_number, client_name, client_phone, client_email, client_address,
            quote_date, validity_days, validity_date, subtotal, discount_percent,
            discount_amount, tax_percent, tax_amount, total_amount, terms, manager_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')");

        $stmt->execute([
            $data['quoteNumber'],
            $data['clientName'],
            $data['clientPhone'] ?? null,
            $data['clientEmail'] ?? null,
            $data['clientAddress'] ?? null,
            $data['quoteDate'],
            $data['validityDays'] ?? 14,
            $data['validityDate'],
            $data['subtotal'] ?? 0,
            $data['discountPercent'] ?? 0,
            $data['discountAmount'] ?? 0,
            $data['taxPercent'] ?? 15,
            $data['taxAmount'] ?? 0,
            $data['totalAmount'] ?? 0,
            $data['terms'] ?? '',
            $data['managerName'] ?? ''
        ]);

        $quoteId = $pdo->lastInsertId();

        // إضافة المنتجات
        if (!empty($data['products']) && is_array($data['products'])) {
            $itemStmt = $pdo->prepare("INSERT INTO quote_items 
                (quote_id, product_name, product_desc, unit, quantity, unit_price, total_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");

            foreach ($data['products'] as $product) {
                $qty = floatval($product['qty'] ?? 0);
                $price = floatval($product['price'] ?? 0);
                $total = $qty * $price;

                $itemStmt->execute([
                    $quoteId,
                    $product['name'] ?? 'صنف جديد',
                    $product['desc'] ?? null,
                    $product['unit'] ?? 'قطعة',
                    $qty,
                    $price,
                    $total
                ]);
            }
        }

        // تسجيل النشاط
        $logStmt = $pdo->prepare("INSERT INTO quote_logs (quote_id, action, details) VALUES (?, ?, ?)");
        $logStmt->execute([
            $quoteId,
            'created',
            "تم إنشاء عرض السعر {$data['quoteNumber']} للعميل {$data['clientName']}"
        ]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'تم حفظ عرض السعر بنجاح',
            'quoteId' => $quoteId,
            'quoteNumber' => $data['quoteNumber']
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// جلب جميع عروض الأسعار
function getAllQuotes($pdo) {
    try {
        $stmt = $pdo->query("SELECT q.*, 
            (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as items_count 
            FROM quotes q ORDER BY q.created_at DESC");
        $quotes = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $quotes]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// جلب عرض سعر محدد
function getQuote($pdo, $quoteNumber) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM quotes WHERE quote_number = ?");
        $stmt->execute([$quoteNumber]);
        $quote = $stmt->fetch();

        if (!$quote) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'عرض السعر غير موجود']);
            return;
        }

        // جلب المنتجات
        $itemStmt = $pdo->prepare("SELECT * FROM quote_items WHERE quote_id = ?");
        $itemStmt->execute([$quote['id']]);
        $quote['items'] = $itemStmt->fetchAll();

        echo json_encode(['success' => true, 'data' => $quote]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// البحث في عروض الأسعار
function searchQuotes($pdo, $query) {
    try {
        $searchTerm = "%$query%";
        $stmt = $pdo->prepare("SELECT * FROM quotes 
            WHERE client_name LIKE ? OR quote_number LIKE ? OR client_phone LIKE ? 
            ORDER BY created_at DESC");
        $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
        $quotes = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $quotes]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// تحديث عرض سعر
function updateQuote($pdo, $id, $data) {
    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("UPDATE quotes SET 
            client_name = ?, client_phone = ?, client_email = ?, client_address = ?,
            quote_date = ?, validity_days = ?, validity_date = ?, subtotal = ?,
            discount_percent = ?, discount_amount = ?, tax_percent = ?, tax_amount = ?,
            total_amount = ?, terms = ?, manager_name = ? WHERE id = ?");

        $stmt->execute([
            $data['clientName'],
            $data['clientPhone'] ?? null,
            $data['clientEmail'] ?? null,
            $data['clientAddress'] ?? null,
            $data['quoteDate'],
            $data['validityDays'] ?? 14,
            $data['validityDate'],
            $data['subtotal'] ?? 0,
            $data['discountPercent'] ?? 0,
            $data['discountAmount'] ?? 0,
            $data['taxPercent'] ?? 15,
            $data['taxAmount'] ?? 0,
            $data['totalAmount'] ?? 0,
            $data['terms'] ?? '',
            $data['managerName'] ?? '',
            $id
        ]);

        // تحديث المنتجات (حذف القديمة وإضافة الجديدة)
        if (!empty($data['products']) && is_array($data['products'])) {
            $pdo->prepare("DELETE FROM quote_items WHERE quote_id = ?")->execute([$id]);
            
            $itemStmt = $pdo->prepare("INSERT INTO quote_items 
                (quote_id, product_name, product_desc, unit, quantity, unit_price, total_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");

            foreach ($data['products'] as $product) {
                $qty = floatval($product['qty'] ?? 0);
                $price = floatval($product['price'] ?? 0);
                $itemStmt->execute([
                    $id,
                    $product['name'] ?? 'صنف جديد',
                    $product['desc'] ?? null,
                    $product['unit'] ?? 'قطعة',
                    $qty,
                    $price,
                    $qty * $price
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'تم تحديث عرض السعر بنجاح']);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// حذف عرض سعر
function deleteQuote($pdo, $id) {
    try {
        // الحذف تلقائي للمنتجات والسجلات بفضل ON DELETE CASCADE
        $stmt = $pdo->prepare("DELETE FROM quotes WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'تم الحذف بنجاح']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>