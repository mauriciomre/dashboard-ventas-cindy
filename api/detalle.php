<?php
// Endpoint: detalle ERP por año/mes/local/rubro (reemplaza el array DET)
// GET /api/detalle.php
// GET /api/detalle.php?anio=2026
// GET /api/detalle.php?anio=2026&mes=6
// GET /api/detalle.php?anio=2026&local=Peatonal
// GET /api/detalle.php?anio=2026&rubro=Bijouterie

require_once __DIR__ . '/config.php';

try {
    $pdo = getDB();

    $where = [];
    $params = [];

    if (!empty($_GET['anio'])) {
        $where[] = 'a = :anio';
        $params['anio'] = (int)$_GET['anio'];
    }
    if (!empty($_GET['mes'])) {
        $where[] = 'm = :mes';
        $params['mes'] = (int)$_GET['mes'];
    }
    if (!empty($_GET['local'])) {
        $where[] = 'l = :local';
        $params['local'] = $_GET['local'];
    }
    if (!empty($_GET['rubro'])) {
        $where[] = 'r = :rubro';
        $params['rubro'] = $_GET['rubro'];
    }

    $sql = 'SELECT a, m, l, r, v, u FROM detalle_ventas';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY a, m, l, r';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Formato compatible con el array DET del dashboard
    $data = array_map(fn($r) => [
        'a' => (int)$r['a'],
        'm' => (int)$r['m'],
        'l' => $r['l'],
        'r' => $r['r'],
        'v' => (float)$r['v'],
        'u' => (int)$r['u'],
    ], $rows);

    echo json_encode(['ok' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
