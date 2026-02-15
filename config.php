<?php
// config.php - إعدادات الاتصال بقاعدة البيانات

$db_host = 'localhost';
$db_name = 'armax_db';
$db_user = 'root';
$db_pass = ''; // ضع كلمة المرور هنا

// إنشاء الجدول إذا لم يكن موجوداً (تشغيل مرة واحدة)
/*
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255),
    google_id VARCHAR(50) UNIQUE,
    avatar VARCHAR(255),
    status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_google (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/
?>