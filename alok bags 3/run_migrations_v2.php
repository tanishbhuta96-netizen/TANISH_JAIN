<?php
require_once __DIR__ . '/api/config.php';

$sql = file_get_contents(__DIR__ . '/migrations_v2.sql');

try {
    $pdo->exec($sql);
    echo "Migrations v2 executed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
