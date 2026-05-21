<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search = $_GET['search'] ?? '';
    $statusFilter = $_GET['status'] ?? 'all';

    $sql = "
        SELECT 
            IFNULL(p.id, 0) as party_id, 
            IFNULL(p.name, 'Walk-in Customers') as customer_name, 
            COUNT(i.id) as invoice_count, 
            SUM(i.total) as total_amount, 
            SUM(i.paid) as total_paid, 
            (SUM(i.total) - SUM(i.paid)) as total_pending
        FROM invoices i
        LEFT JOIN parties p ON p.id = i.party_id
        WHERE 1=1
    ";

    $params = [];
    if (!empty($search)) {
        $sql .= " AND IFNULL(p.name, 'Walk-in Customers') LIKE ?";
        $params[] = '%' . $search . '%';
    }

    $sql .= " GROUP BY p.id ORDER BY p.name ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $results = [];
    foreach ($rows as $row) {
        $pending = (float)$row['total_pending'];
        $paid = (float)$row['total_paid'];
        $amount = (float)$row['total_amount'];

        $status = 'unpaid';
        if ($pending <= 0.01) {
            $status = 'paid';
        } else if ($paid > 0.01) {
            $status = 'partial';
        }

        if ($statusFilter !== 'all' && $statusFilter !== $status) {
            continue; 
        }

        $row['status'] = $status;
        $row['total_amount'] = $amount;
        $row['total_paid'] = $paid;
        $row['total_pending'] = $pending;
        
        $results[] = $row;
    }

    jsonResponse($results);
} else {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
