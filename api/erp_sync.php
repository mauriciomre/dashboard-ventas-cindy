<?php
/**
 * erp_sync.php — Sincronización automática con Manager Max ERP
 *
 * Modos de ejecución:
 *   CLI:  php erp_sync.php [--desde=YYYY-MM] [--hasta=YYYY-MM] [--empresa=3|4] [--dry-run]
 *   HTTP: GET api/erp_sync.php[?desde=YYYY-MM&hasta=YYYY-MM&empresa=3|4&dry_run=1]
 *
 * Sin parámetros: sincroniza el mes anterior y el mes actual.
 * Parámetro especial:  ?modo=historico&desde=2022-01   → sincroniza desde esa fecha hasta hoy.
 *
 * PROTECCIÓN HTTP: requiere sesión PHP activa (admin logueado).
 * Cron no pasa por sesión → se detecta por PHP_SAPI === 'cli'.
 */

// ─── Modo de ejecución ────────────────────────────────────────────────────────
$esCli = PHP_SAPI === 'cli';

if (!$esCli) {
    session_start();
    if (empty($_SESSION['logged_in'])) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'No autorizado']);
        exit;
    }
    header('Content-Type: application/json');
}

require_once __DIR__ . '/config.php';

// ─── Configuración ERP ────────────────────────────────────────────────────────
define('ERP_URL',      'http://190.123.85.167:2022');
define('ERP_USUARIO',  'ClientifyAPI');
define('ERP_PASSWORD', 'ClientifyAPI26');
define('ERP_PAGE_SIZE', 1000);

// IDConcepto del ERP: 7=Factura, 9=Nota de Crédito, 11=Nota de Débito
// Las NC ya vienen con Total negativo → suma directa da ventas netas.
// Los anulados se ignoran.
define('CONCEPTOS_VALIDOS', [7, 9, 11]);

// Mapeo Vendedor ERP → nombre local en el dashboard.
// Ajustar según los locales reales que aparezcan en el ERP.
// Si un Vendedor no está en el mapa, se usa el nombre original del ERP.
define('LOCAL_MAP', [
    'Peatonal VM'        => 'Peatonal',
    'Rivera Indarte Cba' => 'R. Indarte',
    'Casa Central VM'    => 'Casa Central',
    // Agregar más si aparecen nuevos locales al sincronizar:
    // 'Nombre en ERP' => 'Nombre en Dashboard',
]);

// ─── Parseo de parámetros ─────────────────────────────────────────────────────
if ($esCli) {
    $opts    = getopt('', ['desde:', 'hasta:', 'empresa:', 'dry-run']);
    $pDesde  = $opts['desde']   ?? null;
    $pHasta  = $opts['hasta']   ?? null;
    $empresa = isset($opts['empresa']) ? (int)$opts['empresa'] : 3; // PROD por defecto en CLI
    $dryRun  = isset($opts['dry-run']);
} else {
    $pDesde  = $_GET['desde']   ?? null;
    $pHasta  = $_GET['hasta']   ?? null;
    $empresa = isset($_GET['empresa']) ? (int)$_GET['empresa'] : 4; // TEST por defecto en HTTP
    $dryRun  = !empty($_GET['dry_run']);
}

// Rango de fechas por defecto: mes anterior + mes actual
$ahora   = new DateTime();
$defHasta = $ahora->format('Y-m');
$defDesde = (clone $ahora)->modify('-1 month')->format('Y-m');

$desde = $pDesde ?: $defDesde;   // "YYYY-MM"
$hasta = $pHasta ?: $defHasta;   // "YYYY-MM"

// Validar formato
if (!preg_match('/^\d{4}-\d{2}$/', $desde) || !preg_match('/^\d{4}-\d{2}$/', $hasta)) {
    syncSalir(false, 'Formato de fecha inválido. Usar YYYY-MM.', $esCli);
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────
function erpPost(string $path, array $body, string $token = ''): array {
    $ch = curl_init(ERP_URL . $path);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) return ['_error' => $err, 'ErrCode' => 0];
    $data = json_decode($raw, true);
    return $data ?? ['_raw' => $raw, '_http' => $http, 'ErrCode' => $http];
}

// ─── Login ERP ────────────────────────────────────────────────────────────────
function erpLogin(int $empresa): string {
    $resp = erpPost('/Api/Login/LoginUsuarioEmpresa', [
        'CodigoUsuario' => ERP_USUARIO,
        'Contraseña'    => ERP_PASSWORD,
        'IDEmpresa'     => $empresa,
    ]);
    $token = $resp['Data']['Token'] ?? $resp['Token'] ?? '';
    if (empty($token) || ($resp['ErrCode'] ?? 0) !== 200) {
        throw new RuntimeException('Login ERP fallido: ' . json_encode($resp));
    }
    return $token;
}

// ─── Refresh de token ─────────────────────────────────────────────────────────
function erpRefresh(string $token, int $empresa): string {
    $resp = erpPost('/Api/Login/RefreshToken', [
        'IDEmpresa' => $empresa,
    ], $token);
    $nuevo = $resp['Data']['Token'] ?? $resp['Token'] ?? '';
    if (!empty($nuevo)) return $nuevo;
    // Si el refresh falla, hacer re-login
    return erpLogin($empresa);
}

// ─── Construcción del request paginado ───────────────────────────────────────
function buildRequest(string $fechaDesde, string $fechaHasta, int $start, int $length): array {
    return [
        'DTRequest' => [
            'draw'   => 1,
            'order'  => [['columnName' => 'Fecha', 'dir' => 'asc']],
            'start'  => $start,
            'length' => $length,
        ],
        'CalcularTotales'        => false,
        'DefinicionTablaFiltros' => false,
        'ListFilters'            => [
            '$type' => 'System.Collections.Generic.Dictionary`2[[System.String, mscorlib],[UpSoft.Framework.Data.Filters.BaseFilter, UpSoft.Framework.Data]], mscorlib',
            'Fecha' => [
                '$type'    => 'UpSoft.Framework.Data.Filters.FilterDate, UpSoft.Framework.Data',
                'Criteria' => 1,
                'Value1'   => [
                    '$type'         => 'UpSoft.Framework.Common.DateTime.RelativeDate, UpSoft.Framework.Common',
                    'Mode'          => 0,
                    'ValueFixed'    => $fechaDesde . 'T00:00:00',
                    'ValueRelative' => 0,
                ],
                'Value2'   => [
                    '$type'         => 'UpSoft.Framework.Common.DateTime.RelativeDate, UpSoft.Framework.Common',
                    'Mode'          => 0,
                    'ValueFixed'    => $fechaHasta . 'T23:59:59',
                    'ValueRelative' => 0,
                ],
                'DateWithTime' => true,
                'FieldName'    => '',
                'ActiveFilter' => true,
            ],
        ],
    ];
}

// ─── Fetch paginado de comprobantes ──────────────────────────────────────────
function fetchComprobantes(
    string $desde, string $hasta,
    int $empresa, string &$token,
    callable $logFn
): array {

    // Convertir YYYY-MM a primer y último día del rango
    [$anioD, $mesD] = explode('-', $desde);
    [$anioH, $mesH] = explode('-', $hasta);
    $fechaDesde = sprintf('%04d-%02d-01', $anioD, $mesD);
    $fechaHasta = sprintf('%04d-%02d-%02d', $anioH, $mesH,
        (int)(new DateTime("{$anioH}-{$mesH}-01"))->modify('last day of this month')->format('d'));

    $logFn("Rango: {$fechaDesde} → {$fechaHasta}");

    $todos      = [];
    $start      = 0;
    $total      = null;
    $intentos   = 0;
    $maxIntentos = 3;

    do {
        $body = buildRequest($fechaDesde, $fechaHasta, $start, ERP_PAGE_SIZE);
        $resp = erpPost(
            '/Api/informeComprobantesEmitidos/GetDTInformeComprobantesEmitidos',
            $body, $token
        );

        // Token expirado → refresh y reintentar
        if (in_array($resp['ErrCode'] ?? 0, [408, 401])) {
            $logFn("Token expirado, refrescando...");
            $token = erpRefresh($token, $empresa);
            if (++$intentos <= $maxIntentos) continue;
            throw new RuntimeException('Token no se pudo refrescar después de ' . $maxIntentos . ' intentos.');
        }
        $intentos = 0;

        if (($resp['ErrCode'] ?? 0) !== 200) {
            throw new RuntimeException('Error ERP en página ' . ($start / ERP_PAGE_SIZE + 1) . ': ' . json_encode($resp));
        }

        // El endpoint puede devolver los datos directamente en $resp o dentro de $resp['Data']
        $data = isset($resp['Data']) && is_array($resp['Data']) ? $resp['Data'] : $resp;

        if ($total === null) {
            $total = (int)($data['recordsTotal'] ?? 0);
            $logFn("Total comprobantes en ERP: {$total}");
            // Debug: si no hay registros, loguear el response completo para diagnóstico
            if ($total === 0) {
                $logFn("DEBUG response keys: " . implode(', ', array_keys($resp)));
                $logFn("DEBUG data keys: " . implode(', ', is_array($data) ? array_keys($data) : ['(no es array)']));
                $logFn("DEBUG response snippet: " . substr(json_encode($resp), 0, 500));
            }
        }

        $registros = $data['data'] ?? [];
        $todos      = array_merge($todos, $registros);
        $start     += ERP_PAGE_SIZE;

        $pag = (int)ceil($start / ERP_PAGE_SIZE);
        $logFn("Página {$pag}: " . count($registros) . " registros (acumulado: " . count($todos) . ")");

    } while ($start < $total && count($registros) > 0);

    return $todos;
}

// ─── Agregación de comprobantes por mes+local ─────────────────────────────────
function agregarPorMesLocal(array $comprobantes, callable $logFn): array {
    $mapa     = [];  // "YYYY-M" => ["local" => total]
    $omitidos = 0;

    foreach ($comprobantes as $c) {
        // Filtrar anulados
        if (!empty($c['Anulado'])) { $omitidos++; continue; }

        // Solo IDConceptos válidos (FA, NC, ND)
        $idConcepto = (int)($c['IDConcepto'] ?? 0);
        if (!in_array($idConcepto, CONCEPTOS_VALIDOS)) continue;

        // Fecha → anio + mes
        $fechaStr = $c['Fecha'] ?? '';
        if (!preg_match('/^(\d{4})-(\d{2})/', $fechaStr, $m)) continue;
        $anio = (int)$m[1];
        $mes  = (int)$m[2];
        $key  = "{$anio}-{$mes}";

        // Local (Vendedor → mapeado)
        $vendedor = trim($c['Vendedor'] ?? 'Sin asignar');
        $local    = LOCAL_MAP[$vendedor] ?? $vendedor;

        // Total (ya firmado: NC negativo)
        $total = (float)($c['Total'] ?? 0);

        if (!isset($mapa[$key])) $mapa[$key] = [];
        if (!isset($mapa[$key][$local])) $mapa[$key][$local] = 0.0;
        $mapa[$key][$local] += $total;
    }

    if ($omitidos > 0) $logFn("Omitidos (anulados): {$omitidos}");

    return $mapa;
}

// ─── Escritura en la base de datos ────────────────────────────────────────────
function escribirDB(PDO $pdo, array $mapa, bool $dryRun, callable $logFn): array {
    $mesesNombres = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    $mesesTextoArr = [];
    $totalInsertados = 0;

    foreach ($mapa as $key => $localesData) {
        [$anio, $mes] = explode('-', $key);
        $anio = (int)$anio;
        $mes  = (int)$mes;

        // Calcular total del mes y redondear locales
        $totalMes   = 0.0;
        $localesRound = [];
        foreach ($localesData as $local => $valor) {
            $v = round($valor, 2);
            $localesRound[$local] = $v;
            $totalMes += $v;
        }
        $totalMes = round($totalMes, 2);

        $logFn(sprintf("  %s %d: total=$%.2f (%d locales)",
            $mesesNombres[$mes], $anio, $totalMes, count($localesRound)));

        if ($dryRun) {
            $totalInsertados += count($localesRound);
            $mesesTextoArr[] = $mesesNombres[$mes] . ' ' . $anio;
            continue;
        }

        // ── Borrar detalle_ventas del mes ────────────────
        $pdo->prepare('DELETE FROM detalle_ventas WHERE anio = :a AND mes = :m')
            ->execute([':a' => $anio, ':m' => $mes]);

        // ── Insertar detalle_ventas (sin rubro = datos ERP) ──
        $stmtDet = $pdo->prepare(
            'INSERT INTO detalle_ventas (anio, mes, local, rubro, valor, unidades)
             VALUES (:a, :m, :l, :r, :v, :u)'
        );
        foreach ($localesRound as $local => $valor) {
            $stmtDet->execute([
                ':a' => $anio,
                ':m' => $mes,
                ':l' => $local,
                ':r' => 'Sin rubro',   // ERP no provee detalle de artículos/rubro
                ':v' => $valor,
                ':u' => 0,
            ]);
            $totalInsertados++;
        }

        // ── UPSERT ventas_mensuales ──────────────────────
        $lj = json_encode($localesRound, JSON_UNESCAPED_UNICODE);
        $pdo->prepare(
            'INSERT INTO ventas_mensuales (anio, mes, total, locales_json)
             VALUES (:a, :m, :total, :lj)
             ON DUPLICATE KEY UPDATE total = :total2, locales_json = :lj2'
        )->execute([
            ':a'     => $anio,
            ':m'     => $mes,
            ':total' => $totalMes,
            ':lj'    => $lj,
            ':total2'=> $totalMes,
            ':lj2'   => $lj,
        ]);

        $mesesTextoArr[] = $mesesNombres[$mes] . ' ' . $anio;
    }

    return ['insertados' => $totalInsertados, 'meses_texto' => implode(', ', $mesesTextoArr)];
}

// ─── Log de importación ───────────────────────────────────────────────────────
function registrarLog(PDO $pdo, int $insertados, int $cantMeses, string $mesesTexto, bool $esCli): void {
    $usuario = $esCli ? 'cron' : ($_SESSION['user'] ?? 'admin');
    $pdo->prepare(
        'INSERT INTO import_log (usuario, registros, meses_actualizados, meses_texto)
         VALUES (:u, :r, :ma, :mt)'
    )->execute([
        ':u'  => $usuario,
        ':r'  => $insertados,
        ':ma' => $cantMeses,
        ':mt' => $mesesTexto,
    ]);
}

// ─── Helper de salida ─────────────────────────────────────────────────────────
function syncSalir(bool $ok, string $msg, bool $esCli, array $extra = []): void {
    if ($esCli) {
        echo ($ok ? '[OK] ' : '[ERROR] ') . $msg . "\n";
        exit($ok ? 0 : 1);
    } else {
        $resp = array_merge(['ok' => $ok, 'message' => $msg], $extra);
        echo json_encode($resp, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
$log      = [];
$logFn    = function(string $msg) use (&$log, $esCli) {
    $log[] = $msg;
    if ($esCli) echo $msg . "\n";
};

$logFn("=== ERP Sync iniciado ===");
$logFn("Empresa: {$empresa} | Rango: {$desde} → {$hasta}" . ($dryRun ? ' [DRY-RUN]' : ''));

try {
    // 1. Login
    $logFn("Conectando al ERP...");
    $token = erpLogin($empresa);
    $logFn("Login OK.");

    // 2. Fetch comprobantes (paginado)
    $comprobantes = fetchComprobantes($desde, $hasta, $empresa, $token, $logFn);
    $logFn("Total descargado: " . count($comprobantes) . " comprobantes.");

    if (empty($comprobantes)) {
        syncSalir(true, 'No se encontraron comprobantes para el rango indicado.', $esCli,
            ['log' => $log, 'insertados' => 0, 'meses_actualizados' => 0]);
    }

    // 3. Agregar por mes+local
    $mapa = agregarPorMesLocal($comprobantes, $logFn);
    $logFn("Meses a sincronizar: " . count($mapa));

    // 4. Escribir en DB
    $pdo = getDB();

    if (!$dryRun) $pdo->beginTransaction();

    $resultado = escribirDB($pdo, $mapa, $dryRun, $logFn);

    if (!$dryRun) {
        registrarLog($pdo, $resultado['insertados'], count($mapa), $resultado['meses_texto'], $esCli);
        $pdo->commit();
    }

    $msg = sprintf('%s%d filas escritas en %d mes(es): %s',
        $dryRun ? '[DRY-RUN] ' : '',
        $resultado['insertados'],
        count($mapa),
        $resultado['meses_texto']
    );
    $logFn($msg);
    $logFn("=== Sync completado ===");

    syncSalir(true, $msg, $esCli, [
        'insertados'         => $resultado['insertados'],
        'meses_actualizados' => count($mapa),
        'meses_texto'        => $resultado['meses_texto'],
        'dry_run'            => $dryRun,
        'log'                => $log,
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && !$dryRun && $pdo->inTransaction()) $pdo->rollBack();
    $logFn("EXCEPCIÓN: " . $e->getMessage());
    syncSalir(false, $e->getMessage(), $esCli, ['log' => $log]);
}
