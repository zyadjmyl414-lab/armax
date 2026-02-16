<?php
// config.php - إعدادات الاتصال بقاعدة البيانات

$db_host = 'localhost';
$db_name = 'armax_db';
$db_user = 'root';
$db_pass = ''; // ضع كلمة المرور هنا

define('DB_HOST', 'localhost');
define('DB_NAME', 'armax_test');
define('DB_USER', 'root');
define('DB_PASS', ''); // غيره إذا كان لديك باسورد

// إنشاء الاتصال
try {
    $db = new PDO(
        "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", 
        DB_USER, 
        DB_PASS
    );
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die("فشل الاتصال بقاعدة البيانات: " . $e->getMessage());
}
?>