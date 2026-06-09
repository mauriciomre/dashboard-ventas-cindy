<?php
// Endpoint: detalle ERP por año/mes/local/rubro (reemplaza el array DET)
// GET /api/detalle.php

require_once __DIR__ . '/config.php';

try {
    $pdo = getDB();

    $where = [];
    $params = [];

    if (!empty($_GET['anio'])) {
        $where[] = 'anio = :anio';
        $params['anio'] = (int)$_GET['anio'];
    }
    if (!empty($_GET['mes'])) {
        $where[] = 'mes = :mes';
        $params['mes'] = (int)$_GET['mes'];
    }
    if (!empty($_GET['local'])) {
        $where[] = 'local = :local';
        $params['local'] = $_GET['local'];
    }
    if (!empty($_GET['rubro'])) {
        $where[] = 'rubro = :rubro';
        $params['rubro'] = $_GET['rubro'];
    }

    $sql = 'SELECT anio, mes, local, rubro, valor, unidades FROM detalle_ventas';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY anio, mes, local, rubro';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Formato compatible con el array DET del dashboard {a, m, l, r, v, u}
    $data = array_map(fn($r) => [
        'a' => (int)$r['anio'],
        'm' => (int)$r['mes'],
        'l' => $r['local'],
        'r' => $r['rubro'],
        'v' => (float)$r['valor'],
        'u' => (int)$r['unidades'],
    ], $rows);

    echo json_encode(['ok' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
