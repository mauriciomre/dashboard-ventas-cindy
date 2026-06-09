<?php
// Endpoint: importar datos desde ZONA PEGAR ERP
// POST /api/importar.php
// Body JSON: { "action": "auth", "password": "..." }
//         o: { "action": "import", "token": "...", "data": [...] }

require_once __DIR__ . '/config.php';

// =====================================================
// CONTRASEÑA DE IMPORTACIÓN
// Cambiá este valor por una contraseña segura
// =====================================================
define('IMPORT_PASSWORD', 'cindy2026');
define('TOKEN_SECRET', 'cindy_token_secret_2026');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['action'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Solicitud inválida']);
    exit;
}

// =====================================================
// ACCIÓN: AUTH
// =====================================================
if ($input['action'] === 'auth') {
    if (!isset($input['password']) || $input['password'] !== IMPORT_PASSWORD) {
        echo json_encode(['ok' => false, 'error' => 'Contraseña incorrecta']);
        exit;
    }
    // Token simple basado en hash (válido por 8 horas)
    $expires = floor(time() / 28800);
    $token = hash('sha256', TOKEN_SECRET . $expires);
    echo json_encode(['ok' => true, 'token' => $token]);
    exit;
}

// =====================================================
// ACCIÓN: IMPORT
// =====================================================
if ($input['action'] === 'import') {
    // Validar token
    $expires = floor(time() / 28800);
    $tokenValido = hash('sha256', TOKEN_SECRET . $expires);
    $tokenPrev   = hash('sha256', TOKEN_SECRET . ($expires - 1));

    if (!isset($input['token']) || !in_array($input['token'], [$tokenValido, $tokenPrev])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Sesión expirada. Recargá la página.']);
        exit;
    }

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
