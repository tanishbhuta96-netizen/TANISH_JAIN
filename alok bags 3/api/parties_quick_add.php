<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
if (empty($data['name'])) {
    jsonResponse(['error' => 'Party Name is required'], 400);
}

// Minimum 3 chars, no numbers-only
$name = trim($data['name']);
if (strlen($name) < 3 || preg_match('/^[0-9\W_]+$/', $name)) {
    jsonResponse(['error' => 'Invalid party name. Must be at least 3 characters and contain letters.'], 400);
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO parties (name, type, mobile, email, gstin, billing, credit_limit, opening_balance, is_verified, state, city, pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        'customer', // default type
        $data['phone'] ?? '',
        $data['email'] ?? '',
        $data['gstin'] ?? '',
        $data['address'] ?? '',
        $data['credit_limit'] ?? '',
        $data['state'] ?? 'Rajasthan',
        $data['city'] ?? '',
        $data['pincode'] ?? ''
    ]);

    $newId = $pdo->lastInsertId();
    jsonResponse(['id' => (int)$newId, 'name' => $name, 'message' => 'Party added successfully'], 201);
} catch (Exception $e) {
    jsonResponse(['error' => 'Failed to add party: ' . $e->getMessage()], 500);
}
