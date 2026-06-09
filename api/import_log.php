<?php
// Endpoint: historial de importaciones
// GET /api/import_log.php

session_start();
if (empty($_SESSION['logged_in'])) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'No autorizado']); exit; }

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo  = getDB();
    $stmt = $pdo->query(
        'SELECT id, fecha, usuario, registros, meses_actualizados, meses_texto
         FROM import_log
         ORDER BY fecha DESC
         LIMIT 20'
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
