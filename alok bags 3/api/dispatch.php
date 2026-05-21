<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/* ═══════════════════════════════════════════
   ALOK BAGS — Dispatch API
   GET    /api/dispatch.php          → list all
   GET    /api/dispatch.php?id=X    → single
   POST   /api/dispatch.php          → create
   PUT    /api/dispatch.php?id=X    → update status
   DELETE /api/dispatch.php?id=X    → delete
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("
                SELECT d.*, p.name as party_name, i.invoice_no
                FROM dispatches d
                LEFT JOIN parties p ON d.party_id = p.id
                LEFT JOIN invoices i ON d.invoice_id = i.id
                WHERE d.id = ?
            ");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if ($row) jsonResponse($row);
            else jsonResponse(['error' => 'Dispatch not found'], 404);
        } else {
            $status = isset($_GET['status']) ? $_GET['status'] : '';
            $sql = "
                SELECT d.*, p.name as party_name, i.invoice_no
                FROM dispatches d
                LEFT JOIN parties p ON d.party_id = p.id
                LEFT JOIN invoices i ON d.invoice_id = i.id
                WHERE 1=1
            ";
            $params = [];
            if ($status && $status !== 'all') {
                $sql .= " AND d.status = ?";
                $params[] = $status;
            }
            $sql .= " ORDER BY d.dispatch_date DESC, d.id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            jsonResponse($stmt->fetchAll());
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['party_id'])) {
            jsonResponse(['error' => 'Party is required'], 400);
        }

        // Auto-generate dispatch number
        $stmt = $pdo->prepare("SELECT MAX(id) FROM dispatches");
        $stmt->execute();
        $maxId = (int)$stmt->fetchColumn();
        $dispNo = 'DSP-' . str_pad($maxId + 1, 4, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare("
            INSERT INTO dispatches
              (dispatch_no, party_id, invoice_id, dispatch_date, transporter, lr_no, vehicle_no, items_count, total_weight, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $dispNo,
            (int)$data['party_id'],
            !empty($data['invoice_id']) ? (int)$data['invoice_id'] : null,
            $data['dispatch_date'] ?? date('Y-m-d'),
            $data['transporter'] ?? '',
            $data['lr_no'] ?? '',
            $data['vehicle_no'] ?? '',
            (int)($data['items_count'] ?? 0),
            (float)($data['total_weight'] ?? 0),
            $data['status'] ?? 'dispatched',
            $data['notes'] ?? ''
        ]);
        jsonResponse(['id' => (int)$pdo->lastInsertId(), 'dispatch_no' => $dispNo, 'message' => 'Dispatch created'], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $data = json_decode(file_get_contents('php://input'), true);

        $allowed = ['party_id','invoice_id','dispatch_date','transporter','lr_no','vehicle_no','items_count','total_weight','status','notes'];
        $fields = []; $values = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $values[] = $data[$f];
            }
        }
        if (empty($fields)) jsonResponse(['error' => 'Nothing to update'], 400);
        $values[] = $id;
        $pdo->prepare("UPDATE dispatches SET " . implode(', ', $fields) . " WHERE id = ?")->execute($values);
        jsonResponse(['message' => 'Dispatch updated']);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $pdo->prepare("DELETE FROM dispatches WHERE id = ?")->execute([$id]);
        jsonResponse(['message' => 'Dispatch deleted']);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
?>
