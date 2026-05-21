<?php
require_once __DIR__ . '/config.php';

$q = $_GET['q'] ?? '';
if (strlen($q) < 2) {
    jsonResponse([]);
}

$stmt = $pdo->prepare("
    SELECT id, name, hsn as hsn_code, price as default_rate, gst_rate as gst_percent, unit, aliases 
    FROM products 
    WHERE is_active = 1 
      AND (name LIKE ? OR hsn LIKE ? OR aliases LIKE ?) 
    ORDER BY name ASC LIMIT 20
");
$search = "%$q%";
$stmt->execute([$search, $search, $search]);

jsonResponse($stmt->fetchAll());
