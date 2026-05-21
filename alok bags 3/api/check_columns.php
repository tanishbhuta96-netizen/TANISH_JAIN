<?php
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain');

function checkTable($pdo, $tableName) {
    echo "--- Table: $tableName ---\n";
    try {
        $stmt = $pdo->query("DESCRIBE `$tableName`");
        while ($row = $stmt->fetch()) {
            echo "{$row['Field']} ({$row['Type']})\n";
        }
    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

checkTable($pdo, 'invoices');
checkTable($pdo, 'transactions');
checkTable($pdo, 'invoice_payments');
checkTable($pdo, 'sales');
checkTable($pdo, 'payments');
