<?php
// Endpoint: ventas mensuales históricas (reemplaza el array RAW)
// GET /api/ventas_mensuales.php
// GET /api/ventas_mensuales.php?desde=2020&hasta=2026

require_once __DIR__ . '/config.php';

try {
    $pdo = getDB();

    $where = [];
    $params = [];

    if (!empty($_GET['desde'])) {
        $where[] = 'anio >= :desde';
        $params['desde'] = (int)$_GET['desde'];
    }
    if (!empty($_GET['hasta'])) {
        $where[] = 'anio <= :hasta';
        $params['hasta'] = (int)$_GET['hasta'];
    }

    $sql = 'SELECT anio, mes, total, local_peatonal, local_deposito, local_indarte, local_travel_blue
            FROM ventas_mensuales';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY anio, mes';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Formato compatible con el array RAW del dashboard
    $data = array_map(fn($r) => [
        'año' => (int)$r['anio'],
        'mes' => (int)$r['mes'],
        'total' => (float)$r['total'],
        'locales' => [
            'Peatonal'   => (float)$r['local_peatonal'],
            'Deposito'   => (float)$r['local_deposito'],
            'R. Indarte' => (float)$r['local_indarte'],
            'Travel Blue'=> (float)$r['local_travel_blue'],
        ],
    ], $rows);

    echo json_encode(['ok' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
