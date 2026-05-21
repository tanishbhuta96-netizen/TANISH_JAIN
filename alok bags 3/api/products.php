<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/* ═══════════════════════════════════════════
   ALOK BAGS — Products API
   GET    /api/products.php          → list all
   GET    /api/products.php?id=X    → single
   POST   /api/products.php          → create
   PUT    /api/products.php?id=X    → update / stock adjust
   DELETE /api/products.php?id=X    → delete
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch();
            if ($product) jsonResponse($product);
            else jsonResponse(['error' => 'Product not found'], 404);
        } else {
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $sql = "SELECT * FROM products";
            $params = [];
            if ($search) {
                $sql .= " WHERE name LIKE ?";
                $params[] = "%$search%";
            }
            $sql .= " ORDER BY name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            jsonResponse($stmt->fetchAll());
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) jsonResponse(['error' => 'Product name is required'], 400);

        $stmt = $pdo->prepare("INSERT INTO products (name, hsn, unit, price, gst_rate, stock) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['name'],
            $data['hsn'] ?? '',
            $data['unit'] ?? 'pcs',
            (float)($data['price'] ?? 0),
            (float)($data['gst_rate'] ?? 18),
            (int)($data['stock'] ?? 0)
        ]);
        jsonResponse(['id' => (int)$pdo->lastInsertId(), 'message' => 'Product created'], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'Product ID required'], 400);
        $data = json_decode(file_get_contents('php://input'), true);

        // Stock adjustment shortcut: ?action=adjust&id=X with body {adjust: +100 or -50}
        if (isset($data['stock_adjust'])) {
            $pdo->prepare("UPDATE products SET stock = stock + ? WHERE id = ?")->execute([(int)$data['stock_adjust'], $id]);
            jsonResponse(['message' => 'Stock adjusted']);
            break;
        }

        $allowed = ['name','hsn','unit','price','gst_rate','stock','type','is_active'];
        $fields = []; $values = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $values[] = $data[$f];
            }
        }
        if (empty($fields)) jsonResponse(['error' => 'Nothing to update'], 400);
        $values[] = $id;
        $pdo->prepare("UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?")->execute($values);
        jsonResponse(['message' => 'Product updated']);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'Product ID required'], 400);
        $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
        jsonResponse(['message' => 'Product deleted']);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
