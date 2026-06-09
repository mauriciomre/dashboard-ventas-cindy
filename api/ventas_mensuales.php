<?php
// Endpoint: ventas mensuales históricas (reemplaza el array RAW)
// GET /api/ventas_mensuales.php

session_start();
if (empty($_SESSION['logged_in'])) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'No autorizado']); exit; }

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: private, max-age=300'); // 5 min — datos estáticos hasta la próxima importación

try {
    $pdo = getDB();

    $sql = 'SELECT anio, mes, total, locales_json FROM ventas_mensuales ORDER BY anio, mes';
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    $data = array_map(fn($r) => [
        'año'    => (int)$r['anio'],
        'mes'    => (int)$r['mes'],
        'total'  => (float)$r['total'],
        'locales' => json_decode($r['locales_json'], true) ?? [],
    ], $rows);

    echo json_encode(['ok' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
