<?php
require_once __DIR__ . '/config.php';

$q = $_GET['q'] ?? '';
if (strlen($q) < 3) {
    jsonResponse([]);
}

$stmt = $pdo->prepare("SELECT id, name, mobile, gstin, state, city, pincode FROM parties WHERE name LIKE ? ORDER BY name ASC LIMIT 20");
$stmt->execute(["%$q%"]);
$rows = $stmt->fetchAll();

$results = [];
foreach ($rows as $row) {
    if (preg_match('/^[0-9\W_]+$/', $row['name'])) continue;
    $results[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'mobile' => $row['mobile'],
        'gstin' => $row['gstin'],
        'state' => $row['state'],
        'city' => $row['city'],
        'pincode' => $row['pincode']
    ];
}

jsonResponse($results);
