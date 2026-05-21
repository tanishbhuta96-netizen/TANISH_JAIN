<?php
$pdo = new PDO('mysql:host=localhost;dbname=alok_bags_ledger', 'root', 'root');
$stmt = $pdo->query('DESCRIBE invoices');
while ($row = $stmt->fetch()) {
    echo $row['Field'] . "\n";
}
echo "--- transactions ---\n";
$stmt = $pdo->query('DESCRIBE transactions');
while ($row = $stmt->fetch()) {
    echo $row['Field'] . "\n";
}
