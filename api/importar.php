<?php
// Endpoint: importar datos desde ZONA PEGAR ERP
// POST /api/importar.php
// Body JSON: { "action": "import", "data": [...] }

require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['action'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Solicitud inválida']);
    exit;
}

// =====================================================
// ACCIÓN: IMPORT
// =====================================================
if ($input['action'] === 'import') {
    if (empty($input['data']) || !is_array($input['data'])) {
        echo json_encode(['ok' => false, 'error' => 'No se recibieron datos para importar']);
        exit;
    }

    try {
        $pdo = getDB();
        $data = $input['data'];

        // Identificar qué meses vienen en los datos
        $meses = [];
        foreach ($data as $r) {
            $key = intval($r['a']) . '-' . intval($r['m']);
            $meses[$key] = ['a' => intval($r['a']), 'm' => intval($r['m'])];
        }

        // Borrar los registros existentes para esos meses (evitar duplicados)
        $delStmt = $pdo->prepare('DELETE FROM detalle_ventas WHERE anio = :a AND mes = :m');
        foreach ($meses as $mes) {
            $delStmt->execute([':a' => $mes['a'], ':m' => $mes['m']]);
        }

        // Insertar nuevos registros
        $insStmt = $pdo->prepare(
            'INSERT INTO detalle_ventas (anio, mes, local, rubro, valor, unidades)
             VALUES (:a, :m, :l, :r, :v, :u)'
        );

        $insertados = 0;
        foreach ($data as $r) {
            $insStmt->execute([
                ':a' => intval($r['a']),
                ':m' => intval($r['m']),
                ':l' => $r['l'],
                ':r' => $r['r'],
                ':v' => round(floatval($r['v']), 2),
                ':u' => intval($r['u']),
            ]);
            $insertados++;
        }

        echo json_encode([
            'ok'                 => true,
            'insertados'         => $insertados,
            'meses_actualizados' => count($meses),
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Acción no reconocida']);
