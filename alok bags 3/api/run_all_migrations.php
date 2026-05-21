<?php
/* ═══════════════════════════════════════════
   ALOK BAGS — Master Migration Runner
   Applies all schema changes safely
   ═══════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$done = [];
$errors = [];

function tryExec($pdo, $sql, $label, &$done, &$errors) {
    try {
        $pdo->exec($sql);
        $done[] = "✅ $label";
    } catch (PDOException $e) {
        // Duplicate column / already exists = skip
        if (strpos($e->getMessage(), '1060') !== false || strpos($e->getMessage(), '1061') !== false || strpos($e->getMessage(), '1050') !== false) {
            $done[] = "⏭️  $label (already exists)";
        } else {
            $errors[] = "❌ $label: " . $e->getMessage();
        }
    }
}

// ── migrations.sql ──────────────────────────────────────

tryExec($pdo, "ALTER TABLE invoices MODIFY party_id INT NULL", 'invoices.party_id nullable', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN customer_type ENUM('saved','walkin') DEFAULT 'saved'", 'invoices.customer_type', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN walkin_name VARCHAR(255) NULL", 'invoices.walkin_name', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN walkin_phone VARCHAR(20) NULL", 'invoices.walkin_phone', $done, $errors);
tryExec($pdo, "ALTER TABLE transactions MODIFY party_id INT NULL", 'transactions.party_id nullable', $done, $errors);
tryExec($pdo, "ALTER TABLE products ADD COLUMN aliases VARCHAR(255) DEFAULT ''", 'products.aliases', $done, $errors);
tryExec($pdo, "ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT TRUE", 'products.is_active', $done, $errors);
tryExec($pdo, "ALTER TABLE parties ADD COLUMN is_verified BOOLEAN DEFAULT FALSE", 'parties.is_verified', $done, $errors);

// ── migrations_v2.sql ───────────────────────────────────

tryExec($pdo, "ALTER TABLE parties ADD COLUMN state VARCHAR(100) DEFAULT 'Rajasthan'", 'parties.state', $done, $errors);
tryExec($pdo, "ALTER TABLE parties ADD COLUMN city VARCHAR(100) NULL", 'parties.city', $done, $errors);
tryExec($pdo, "ALTER TABLE parties ADD COLUMN pincode VARCHAR(10) NULL", 'parties.pincode', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN tax_type ENUM('cgst_sgst','igst') DEFAULT 'cgst_sgst'", 'invoices.tax_type', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN party_state VARCHAR(100) NULL", 'invoices.party_state', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(10,2) DEFAULT 0", 'invoices.cgst_amount', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(10,2) DEFAULT 0", 'invoices.sgst_amount', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(10,2) DEFAULT 0", 'invoices.igst_amount', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN payment_mode ENUM('pending','cash','upi','cheque','bank_transfer') DEFAULT 'pending'", 'invoices.payment_mode', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN payment_note VARCHAR(255) NULL", 'invoices.payment_note', $done, $errors);
tryExec($pdo, "ALTER TABLE invoices ADD COLUMN payment_date DATE NULL", 'invoices.payment_date', $done, $errors);

// ── transactions extra columns (migrate.php) ────────────

tryExec($pdo, "ALTER TABLE transactions ADD COLUMN payment_method ENUM('cash','upi','bank') DEFAULT NULL", 'transactions.payment_method', $done, $errors);
tryExec($pdo, "ALTER TABLE transactions ADD COLUMN note TEXT DEFAULT NULL", 'transactions.note', $done, $errors);

// ── products extra column ────────────────────────────────

tryExec($pdo, "ALTER TABLE products ADD COLUMN type ENUM('finished','raw') DEFAULT 'finished'", 'products.type', $done, $errors);

// ── purchases tables (migrate_purchases.php) ────────────

tryExec($pdo, "CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_no VARCHAR(50) NOT NULL,
    party_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    due_date DATE DEFAULT NULL,
    subtotal DECIMAL(14,2) DEFAULT 0.00,
    discount DECIMAL(14,2) DEFAULT 0.00,
    tax_amount DECIMAL(14,2) DEFAULT 0.00,
    transport_charges DECIMAL(14,2) DEFAULT 0.00,
    extra_charges DECIMAL(14,2) DEFAULT 0.00,
    total DECIMAL(14,2) DEFAULT 0.00,
    paid DECIMAL(14,2) DEFAULT 0.00,
    status ENUM('paid','partial','unpaid','cancelled') DEFAULT 'unpaid',
    bill_image VARCHAR(255) DEFAULT NULL,
    ocr_raw_text LONGTEXT DEFAULT NULL,
    ai_structured_data LONGTEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB", 'Create table: purchases', $done, $errors);

tryExec($pdo, "CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NULL,
    description VARCHAR(200) DEFAULT '',
    qty DECIMAL(10,3) DEFAULT 1.000,
    unit VARCHAR(20) DEFAULT 'pcs',
    price DECIMAL(12,2) DEFAULT 0.00,
    discount_pct DECIMAL(5,2) DEFAULT 0.00,
    gst_rate DECIMAL(5,2) DEFAULT 18.00,
    amount DECIMAL(14,2) DEFAULT 0.00,
    tax_amount DECIMAL(14,2) DEFAULT 0.00,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB", 'Create table: purchase_items', $done, $errors);

tryExec($pdo, "CREATE TABLE IF NOT EXISTS purchase_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    method ENUM('cash','upi','bank') DEFAULT 'cash',
    paid_on DATE NOT NULL,
    note TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB", 'Create table: purchase_payments', $done, $errors);

// In case ocr/ai columns missing from older purchases table
tryExec($pdo, "ALTER TABLE purchases ADD COLUMN ocr_raw_text LONGTEXT DEFAULT NULL", 'purchases.ocr_raw_text', $done, $errors);
tryExec($pdo, "ALTER TABLE purchases ADD COLUMN ai_structured_data LONGTEXT DEFAULT NULL", 'purchases.ai_structured_data', $done, $errors);

// ── transactions payment columns used by transactions.php ──
tryExec($pdo, "ALTER TABLE transactions ADD COLUMN payment_mode VARCHAR(50) DEFAULT NULL", 'transactions.payment_mode', $done, $errors);
tryExec($pdo, "ALTER TABLE transactions ADD COLUMN payment_date DATE DEFAULT NULL", 'transactions.payment_date', $done, $errors);
tryExec($pdo, "ALTER TABLE transactions ADD COLUMN payment_note TEXT DEFAULT NULL", 'transactions.payment_note', $done, $errors);

// ── fix invoice_payments method ENUM to include cheque ──
tryExec($pdo, "ALTER TABLE invoice_payments MODIFY COLUMN method ENUM('cash','upi','bank','cheque') DEFAULT 'cash'", 'invoice_payments.method add cheque', $done, $errors);

// ── fix purchase_payments method ENUM to include cheque ──
tryExec($pdo, "ALTER TABLE purchase_payments MODIFY COLUMN method ENUM('cash','upi','bank','cheque') DEFAULT 'cash'", 'purchase_payments.method add cheque', $done, $errors);

// ── transactions type column: allow payment_received, payment_given ──
tryExec($pdo, "ALTER TABLE transactions MODIFY COLUMN type VARCHAR(50) NOT NULL", 'transactions.type varchar', $done, $errors);

// ── production_jobs table ──────────────────────────────────────────────
tryExec($pdo, "CREATE TABLE IF NOT EXISTS production_jobs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    job_no        VARCHAR(30) NOT NULL,
    product_id    INT NULL,
    description   VARCHAR(200) DEFAULT '',
    target_qty    DECIMAL(10,3) DEFAULT 0,
    actual_qty    DECIMAL(10,3) DEFAULT 0,
    rejected_qty  DECIMAL(10,3) DEFAULT 0,
    worker        VARCHAR(100) DEFAULT '',
    start_date    DATE DEFAULT NULL,
    end_date      DATE DEFAULT NULL,
    status        ENUM('pending','in_progress','completed','cancelled') DEFAULT 'pending',
    notes         TEXT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB", 'Create table: production_jobs', $done, $errors);

// ── dispatches table ───────────────────────────────────────────────────
tryExec($pdo, "CREATE TABLE IF NOT EXISTS dispatches (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    dispatch_no   VARCHAR(30) NOT NULL,
    party_id      INT NOT NULL,
    invoice_id    INT NULL,
    dispatch_date DATE NOT NULL,
    transporter   VARCHAR(150) DEFAULT '',
    lr_no         VARCHAR(50)  DEFAULT '',
    vehicle_no    VARCHAR(30)  DEFAULT '',
    items_count   INT DEFAULT 0,
    total_weight  DECIMAL(10,3) DEFAULT 0,
    status        ENUM('pending','dispatched','in_transit','delivered','returned') DEFAULT 'dispatched',
    notes         TEXT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id)    REFERENCES parties(id)   ON DELETE CASCADE,
    FOREIGN KEY (invoice_id)  REFERENCES invoices(id)  ON DELETE SET NULL
) ENGINE=InnoDB", 'Create table: dispatches', $done, $errors);

echo json_encode([
    'status'  => count($errors) === 0 ? 'ok' : 'partial',
    'done'    => $done,
    'errors'  => $errors
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
