<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

try {
    echo "Starting DB Fix Migration...\n";

    // 1. Add columns to invoices
    echo "Updating invoices table...\n";
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash'");
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE NULL");
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_note VARCHAR(255) NULL");

    // 2. Add columns to invoice_payments (assuming this is what the user meant by 'payments')
    echo "Updating invoice_payments table...\n";
    $pdo->exec("ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash'");
    $pdo->exec("ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS payment_note VARCHAR(255) NULL");

    // 3. Also check if a table named 'payments' exists and update it just in case
    $stmt = $pdo->query("SHOW TABLES LIKE 'payments'");
    if ($stmt->fetch()) {
        echo "Updating payments table...\n";
        $pdo->exec("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash'");
        $pdo->exec("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_note VARCHAR(255) NULL");
    }

    echo "\nSUCCESS: Migration completed successfully.\n";
} catch (Exception $e) {
    echo "\nERROR: " . $e->getMessage() . "\n";
}
