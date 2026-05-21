<?php
$pdo = new PDO('mysql:host=localhost;dbname=alok_bags_ledger', 'root', 'root');
$stmt = $pdo->query('SHOW TABLES');
while ($row = $stmt->fetch()) {
    echo $row[0] . "\n";
}
