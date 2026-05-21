<?php
require_once __DIR__ . '/api/config.php';

$sql = file_get_contents(__DIR__ . '/migrations.sql');

try {
    $pdo->exec($sql);
    echo "Migrations executed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
