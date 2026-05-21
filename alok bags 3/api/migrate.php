<?php
/* ═══════════════════════════════════════════
   ALOK BAGS — DB Migration
   Adds tables for Sales/Billing System
   ═══════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$migrations = [];

// 1. Add payment_method and note to transactions (from previous migration)
try {
    $pdo->exec("ALTER TABLE transactions ADD COLUMN payment_method ENUM('cash','upi','bank') DEFAULT NULL");
    $migrations[] = 'Added: payment_method';
} catch (PDOException $e) { /* skip if exists */ }

try {
    $pdo->exec("ALTER TABLE transactions ADD COLUMN note TEXT DEFAULT NULL");
    $migrations[] = 'Added: note to transactions';
} catch (PDOException $e) { /* skip if exists */ }

// 2. Create products table
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        hsn VARCHAR(20) DEFAULT '',
        unit VARCHAR(20) DEFAULT 'pcs',
        price DECIMAL(12,2) DEFAULT 0.00,
        gst_rate DECIMAL(5,2) DEFAULT 18.00,
        stock INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    $migrations[] = 'Created table: products';
} catch (PDOException $e) { throw $e; }

// 3. Create invoices table
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_no VARCHAR(30) UNIQUE NOT NULL,
        party_id INT NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE DEFAULT NULL,
        subtotal DECIMAL(14,2) DEFAULT 0.00,
        discount DECIMAL(14,2) DEFAULT 0.00,
        tax_amount DECIMAL(14,2) DEFAULT 0.00,
        total DECIMAL(14,2) DEFAULT 0.00,
        paid DECIMAL(14,2) DEFAULT 0.00,
        status ENUM('paid','partial','unpaid','cancelled') DEFAULT 'unpaid',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;");
    $migrations[] = 'Created table: invoices';
} catch (PDOException $e) { throw $e; }

// 3.5 Add bill_type to invoices if exists
try {
    $pdo->exec("ALTER TABLE invoices ADD COLUMN bill_type ENUM('gst','non_gst') DEFAULT 'gst'");
    $migrations[] = 'Added: bill_type to invoices';
} catch (PDOException $e) { /* skip if exists */ }

// 4. Create invoice_items table
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        product_id INT NULL,
        description VARCHAR(200) DEFAULT '',
        qty DECIMAL(10,3) DEFAULT 1.000,
        unit VARCHAR(20) DEFAULT 'pcs',
        price DECIMAL(12,2) DEFAULT 0.00,
        discount_pct DECIMAL(5,2) DEFAULT 0.00,
        gst_rate DECIMAL(5,2) DEFAULT 18.00,
        amount DECIMAL(14,2) DEFAULT 0.00,
        tax_amount DECIMAL(14,2) DEFAULT 0.00,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;");
    $migrations[] = 'Created table: invoice_items';
} catch (PDOException $e) { throw $e; }

// 5. Create invoice_payments table
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS invoice_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        method ENUM('cash','upi','bank') DEFAULT 'cash',
        paid_on DATE NOT NULL,
        note TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;");
    $migrations[] = 'Created table: invoice_payments';
} catch (PDOException $e) { throw $e; }

// 6. Seed initial products if none exist
try {
    $stmt = $pdo->query("SELECT COUNT(*) FROM products");
    if ($stmt->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO products (name, hsn, unit, price, gst_rate, stock) VALUES
            ('D-Cut Non Woven Bag (10x14)', '3923', 'kg', 120.00, 18.00, 500),
            ('W-Cut Non Woven Bag (12x16)', '3923', 'kg', 135.00, 18.00, 300),
            ('Loop Handle Bag (14x18)', '3923', 'kg', 150.00, 18.00, 200),
            ('BOPP Laminated Bag (16x20)', '3923', 'pcs', 18.50, 18.00, 1500),
            ('Box Bag with Zipper (12x12x6)', '4202', 'pcs', 45.00, 18.00, 400)
        ");
        $migrations[] = 'Seeded products';
    }
} catch (PDOException $e) { throw $e; }

echo json_encode(['status' => 'ok', 'migrations' => $migrations]);
