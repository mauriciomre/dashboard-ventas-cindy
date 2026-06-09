<?php
// Endpoint: importar datos desde ZONA PEGAR ERP
// POST /api/importar.php
// Body JSON: { "action": "import", "data": [...] }

session_start();
if (empty($_SESSION['logged_in'])) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'No autorizado']); exit; }

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

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
        $pdo  = getDB();
        $data = $input['data'];

        // ── Identificar meses afectados ──────────────────
        $meses = [];
        foreach ($data as $r) {
            $key = intval($r['a']) . '-' . intval($r['m']);
            $meses[$key] = ['a' => intval($r['a']), 'm' => intval($r['m'])];
        }
        ksort($meses);

        $pdo->beginTransaction();

        // ── Borrar detalle_ventas para esos meses ────────
        $delDet = $pdo->prepare('DELETE FROM detalle_ventas WHERE anio = :a AND mes = :m');
        foreach ($meses as $mes) {
            $delDet->execute([':a' => $mes['a'], ':m' => $mes['m']]);
        }

        // ── Insertar nuevos registros en detalle_ventas ──
        $insDet = $pdo->prepare(
            'INSERT INTO detalle_ventas (anio, mes, local, rubro, valor, unidades)
             VALUES (:a, :m, :l, :r, :v, :u)'
        );
        $insertados = 0;
        foreach ($data as $r) {
            $insDet->execute([
                ':a' => intval($r['a']),
                ':m' => intval($r['m']),
                ':l' => $r['l'],
                ':r' => $r['r'],
                ':v' => round(floatval($r['v']), 2),
                ':u' => intval($r['u']),
            ]);
            $insertados++;
        }

        // ── Recalcular y sincronizar ventas_mensuales ────
        // Para cada mes importado, sumar total y desglose por local, luego hacer UPSERT
        $upsertVM = $pdo->prepare(
            'INSERT INTO ventas_mensuales (anio, mes, total, locales_json)
             VALUES (:a, :m, :total, :lj)
             ON DUPLICATE KEY UPDATE total = :total2, locales_json = :lj2'
        );

        foreach ($meses as $mes) {
            $rows = $pdo->prepare(
                'SELECT local, SUM(valor) AS subtotal
                 FROM detalle_ventas
                 WHERE anio = :a AND mes = :m
                 GROUP BY local'
            );
            $rows->execute([':a' => $mes['a'], ':m' => $mes['m']]);
            $localesData = $rows->fetchAll(PDO::FETCH_ASSOC);

            $localesMap = [];
            $totalMes   = 0;
            foreach ($localesData as $ld) {
                $localesMap[$ld['local']] = round((float)$ld['subtotal'], 2);
                $totalMes += (float)$ld['subtotal'];
            }
            $lj = json_encode($localesMap, JSON_UNESCAPED_UNICODE);
            $upsertVM->execute([
                ':a'     => $mes['a'],
                ':m'     => $mes['m'],
                ':total' => round($totalMes, 2),
                ':lj'    => $lj,
                ':total2'=> round($totalMes, 2),
                ':lj2'   => $lj,
            ]);
        }

        // ── Registrar en import_log ───────────────────────
        $MESES_NOMBRES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        $mesesTexto = implode(', ', array_map(
            fn($m) => $MESES_NOMBRES[$m['m']] . ' ' . $m['a'],
            array_values($meses)
        ));
        $usuario = $_SESSION['user'] ?? 'admin';
        $logStmt = $pdo->prepare(
            'INSERT INTO import_log (usuario, registros, meses_actualizados, meses_texto)
             VALUES (:u, :r, :ma, :mt)'
        );
        $logStmt->execute([
            ':u'  => $usuario,
            ':r'  => $insertados,
            ':ma' => count($meses),
            ':mt' => $mesesTexto,
        ]);

        $pdo->commit();

        echo json_encode([
            'ok'                 => true,
            'insertados'         => $insertados,
            'meses_actualizados' => count($meses),
        ]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Acción no reconocida']);
