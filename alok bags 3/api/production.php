<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/* ═══════════════════════════════════════════
   ALOK BAGS — Production Jobs API
   GET    /api/production.php          → list all jobs
   GET    /api/production.php?id=X    → single job
   POST   /api/production.php          → create job
   PUT    /api/production.php?id=X    → update job
   DELETE /api/production.php?id=X    → delete job
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT j.*, p.name as product_name FROM production_jobs j LEFT JOIN products p ON j.product_id = p.id WHERE j.id = ?");
            $stmt->execute([$id]);
            $job = $stmt->fetch();
            if ($job) jsonResponse($job);
            else jsonResponse(['error' => 'Job not found'], 404);
        } else {
            $status = isset($_GET['status']) ? $_GET['status'] : '';
            $sql = "SELECT j.*, p.name as product_name FROM production_jobs j LEFT JOIN products p ON j.product_id = p.id WHERE 1=1";
            $params = [];
            if ($status && $status !== 'all') {
                $sql .= " AND j.status = ?";
                $params[] = $status;
            }
            $sql .= " ORDER BY j.created_at DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $jobs = $stmt->fetchAll();
            foreach ($jobs as &$j) {
                $j['target_qty']   = (float)$j['target_qty'];
                $j['actual_qty']   = (float)$j['actual_qty'];
                $j['rejected_qty'] = (float)$j['rejected_qty'];
            }
            jsonResponse($jobs);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['description']) && empty($data['product_id'])) {
            jsonResponse(['error' => 'Product or description is required'], 400);
        }

        // Auto-generate job number
        $stmt = $pdo->prepare("SELECT MAX(id) FROM production_jobs");
        $stmt->execute();
        $maxId = (int)$stmt->fetchColumn();
        $jobNo = 'JOB-' . str_pad($maxId + 1, 4, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare("
            INSERT INTO production_jobs
              (job_no, product_id, description, target_qty, actual_qty, rejected_qty, worker, start_date, end_date, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $jobNo,
            !empty($data['product_id']) ? (int)$data['product_id'] : null,
            $data['description'] ?? '',
            (float)($data['target_qty'] ?? 0),
            (float)($data['actual_qty'] ?? 0),
            (float)($data['rejected_qty'] ?? 0),
            $data['worker'] ?? '',
            $data['start_date'] ?? date('Y-m-d'),
            $data['end_date'] ?? null,
            $data['status'] ?? 'pending',
            $data['notes'] ?? ''
        ]);
        jsonResponse(['id' => (int)$pdo->lastInsertId(), 'job_no' => $jobNo, 'message' => 'Job created'], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'Job ID required'], 400);
        $data = json_decode(file_get_contents('php://input'), true);

        $allowed = ['product_id','description','target_qty','actual_qty','rejected_qty','worker','start_date','end_date','status','notes'];
        $fields = []; $values = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $values[] = $data[$f];
            }
        }
        if (empty($fields)) jsonResponse(['error' => 'Nothing to update'], 400);
        $values[] = $id;
        $pdo->prepare("UPDATE production_jobs SET " . implode(', ', $fields) . " WHERE id = ?")->execute($values);
        jsonResponse(['message' => 'Job updated']);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'Job ID required'], 400);
        $pdo->prepare("DELETE FROM production_jobs WHERE id = ?")->execute([$id]);
        jsonResponse(['message' => 'Job deleted']);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
?>
