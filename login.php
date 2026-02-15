<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php'; // ملف الإعدادات (ستنشئه في الخطوة التالية)

class UserAuth {
    private $pdo;
    private $secret_key = "your_secret_key_here_change_this_in_production";
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    // تسجيل الدخول العادي
    public function login($email, $password, $remember = false) {
        try {
            $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ? AND status = 'active'");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                return ['success' => false, 'message' => 'البريد الإلكتروني غير مسجل'];
            }
            
            if (!password_verify($password, $user['password'])) {
                return ['success' => false, 'message' => 'كلمة المرور غير صحيحة'];
            }
            
            // تحديث آخر دخول
            $stmt = $this->pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user['id']]);
            
            $token = $this->generateToken($user);
            
            return [
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'phone' => $user['phone'],
                    'avatar' => $user['avatar']
                ]
            ];
            
        } catch (PDOException $e) {
            return ['success' => false, 'message' => 'خطأ في قاعدة البيانات'];
        }
    }
    
    // إنشاء حساب جديد
    public function register($data) {
        try {
            // التحقق من وجود البريد
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$data['email']]);
            if ($stmt->fetch()) {
                return ['success' => false, 'message' => 'البريد الإلكتروني مستخدم مسبقاً'];
            }
            
            // التحقق من وجود رقم الجوال
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE phone = ?");
            $stmt->execute([$data['phone']]);
            if ($stmt->fetch()) {
                return ['success' => false, 'message' => 'رقم الجوال مستخدم مسبقاً'];
            }
            
            $name = $data['firstName'] . ' ' . $data['lastName'];
            $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
            
            $stmt = $this->pdo->prepare("
                INSERT INTO users (name, email, phone, password, status, created_at, last_login) 
                VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
            ");
            
            $stmt->execute([
                $name,
                $data['email'],
                $data['phone'],
                $hashedPassword
            ]);
            
            $userId = $this->pdo->lastInsertId();
            
            $token = $this->generateToken([
                'id' => $userId,
                'email' => $data['email'],
                'name' => $name
            ]);
            
            return [
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'avatar' => null
                ],
                'message' => 'تم إنشاء الحساب بنجاح'
            ];
            
        } catch (PDOException $e) {
            return ['success' => false, 'message' => 'فشل إنشاء الحساب: ' . $e->getMessage()];
        }
    }
    
    // تسجيل الدخول عبر Google
    public function googleLogin($credential) {
        // التحقق من توكن Google
        $googleClientId = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
        
        // في الإنتاج، استخدم مكتبة Google API Client للتحقق
        // هنا نقوم بفك التوكن بشكل بسيط للتوضيح
        
        $tokenParts = explode('.', $credential);
        if (count($tokenParts) != 3) {
            return ['success' => false, 'message' => 'توكن غير صالح'];
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        
        if (!$payload || $payload['aud'] != $googleClientId) {
            return ['success' => false, 'message' => 'فشل التحقق من Google'];
        }
        
        $email = $payload['email'];
        $name = $payload['name'] ?? $payload['given_name'] . ' ' . $payload['family_name'];
        $googleId = $payload['sub'];
        $avatar = $payload['picture'] ?? null;
        
        try {
            // التحقق من وجود المستخدم
            $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ? OR google_id = ?");
            $stmt->execute([$email, $googleId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // تحديث بيانات Google إذا كان المستخدم موجوداً
                if (!$user['google_id']) {
                    $stmt = $this->pdo->prepare("UPDATE users SET google_id = ?, avatar = ? WHERE id = ?");
                    $stmt->execute([$googleId, $avatar, $user['id']]);
                }
                
                $userId = $user['id'];
            } else {
                // إنشاء مستخدم جديد
                $stmt = $this->pdo->prepare("
                    INSERT INTO users (name, email, google_id, avatar, status, created_at, last_login) 
                    VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
                ");
                $stmt->execute([$name, $email, $googleId, $avatar]);
                $userId = $this->pdo->lastInsertId();
            }
            
            $token = $this->generateToken([
                'id' => $userId,
                'email' => $email,
                'name' => $name
            ]);
            
            return [
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'email' => $email,
                    'avatar' => $avatar
                ],
                'message' => 'تم تسجيل الدخول عبر Google بنجاح'
            ];
            
        } catch (PDOException $e) {
            return ['success' => false, 'message' => 'خطأ في قاعدة البيانات'];
        }
    }
    
    private function generateToken($user) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $time = time();
        $payload = json_encode([
            'iss' => 'armax',
            'iat' => $time,
            'exp' => $time + (60 * 60 * 24 * 30), // 30 يوم
            'sub' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name']
        ]);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $this->secret_key, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }
}

// معالجة الطلب
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    $auth = new UserAuth($pdo);
    
    switch($action) {
        case 'login':
            $result = $auth->login(
                $input['email'] ?? '',
                $input['password'] ?? '',
                $input['remember'] ?? false
            );
            break;
            
        case 'register':
            $result = $auth->register($input);
            break;
            
        case 'google_login':
            $result = $auth->googleLogin($input['credential'] ?? '');
            break;
            
        default:
            $result = ['success' => false, 'message' => 'إجراء غير معروف'];
    }
    
    echo json_encode($result);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'فشل الاتصال بقاعدة البيانات']);
}
?>