<?php
/**
 * erp_discovery.php — Script de descubrimiento Manager Max API
 * Ejecutar UNA VEZ desde el servidor para ver el schema y datos de prueba.
 * ELIMINAR o proteger después de usar.
 */

session_start();
if (empty($_SESSION['logged_in'])) {
    header('Location: ../index.php');
    exit;
}

// ─── Configuración ────────────────────────────────────────────────────────────
define('ERP_URL',      'http://190.123.85.167:2022');
define('ERP_USUARIO',  'ClientifyAPI');
define('ERP_PASSWORD', 'ClientifyAPI26');
define('ERP_EMPRESA',  4); // TEST=4, PROD=3

// ─── Cliente HTTP minimalista ─────────────────────────────────────────────────
function erp_post(string $path, array $body, string $token = ''): array {
    $ch = curl_init(ERP_URL . $path);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) return ['_curl_error' => $err];
    $data = json_decode($raw, true);
    if ($data === null) return ['_raw' => $raw, '_http' => $http];
    return $data;
}

// ─── Login ────────────────────────────────────────────────────────────────────
$loginResp = erp_post('/Api/Login/LoginUsuarioEmpresa', [
    'CodigoUsuario' => ERP_USUARIO,
    'Contraseña'    => ERP_PASSWORD,
    'IDEmpresa'     => ERP_EMPRESA,
]);

$token = $loginResp['Data']['Token'] ?? $loginResp['Token'] ?? '';
$loginOk = ($loginResp['ErrCode'] ?? 0) === 200 && $token;

// ─── Helpers de filtros ───────────────────────────────────────────────────────
function filterDate(string $from, string $to): array {
    return [
        '$type'    => 'UpSoft.Framework.Data.Filters.FilterDate, UpSoft.Framework.Data',
        'Criteria' => 1,
        'Value1'   => [
            '$type'         => 'UpSoft.Framework.Common.DateTime.RelativeDate, UpSoft.Framework.Common',
            'Mode'          => 0,
            'ValueFixed'    => $from,
            'ValueRelative' => 0,
        ],
        'Value2'   => [
            '$type'         => 'UpSoft.Framework.Common.DateTime.RelativeDate, UpSoft.Framework.Common',
            'Mode'          => 0,
            'ValueFixed'    => $to,
            'ValueRelative' => 0,
        ],
        'DateWithTime' => true,
        'FieldName'    => '',
        'ActiveFilter' => true,
    ];
}

function dtRequest(bool $soloSchema = false, int $start = 0, int $length = 5): array {
    return [
        'DTRequest' => [
            'draw'   => 1,
            'order'  => [['columnName' => 'Fecha', 'dir' => 'desc']],
            'start'  => $start,
            'length' => $soloSchema ? 0 : $length,
        ],
        'CalcularTotales'        => false,
        'DefinicionTablaFiltros' => $soloSchema,
        'ListFilters'            => [
            '$type' => 'System.Collections.Generic.Dictionary`2[[System.String, mscorlib],[UpSoft.Framework.Data.Filters.BaseFilter, UpSoft.Framework.Data]], mscorlib',
            'Fecha' => filterDate('2025-01-01T00:00:00', '2025-12-31T23:59:59'),
        ],
    ];
}

$results = [];

if ($loginOk) {
    // 1) Schema del endpoint principal
    $results['schema_comprobantes'] = erp_post(
        '/Api/informeComprobantesEmitidos/GetDTInformeComprobantesEmitidos',
        dtRequest(true),
        $token
    );

    // 2) Muestra de 5 comprobantes reales (2025)
    $results['muestra_comprobantes'] = erp_post(
        '/Api/informeComprobantesEmitidos/GetDTInformeComprobantesEmitidos',
        dtRequest(false, 0, 5),
        $token
    );

    // 3) Schema de GetDTInformeComprobantesEmitidosFA (solo facturas)
    $results['schema_FA'] = erp_post(
        '/Api/informeComprobantesEmitidos/GetDTInformeComprobantesEmitidosFA',
        dtRequest(true),
        $token
    );

    // 4) Schema del detalle de comprobante
    $results['schema_detalle'] = erp_post(
        '/Api/cuentacorriente/GetDTDetalleComprobante',
        array_merge(dtRequest(true), ['IDComprobante' => 0]),
        $token
    );
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>ERP Discovery — Manager Max</title>
<style>
  body { font-family: monospace; background: #0f172a; color: #e2e8f0; padding: 20px; }
  h2   { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px; }
  h3   { color: #a3e635; }
  pre  { background: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px;
         overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
  .ok  { color: #4ade80; } .err { color: #f87171; }
  .box { background: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
</style>
</head>
<body>

<h2>🔍 Manager Max — Discovery</h2>

<div class="box">
  <h3>Login</h3>
  <p>URL: <strong><?= ERP_URL ?></strong> | Empresa: <strong><?= ERP_EMPRESA ?></strong></p>
  <p>Estado: <?php if ($loginOk): ?><span class="ok">✅ OK — Token obtenido</span>
  <?php else: ?><span class="err">❌ FALLÓ</span>
  <pre><?= htmlspecialchars(json_encode($loginResp, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></pre>
  <?php endif; ?>
  </p>
</div>

<?php if ($loginOk): ?>

<?php foreach ($results as $key => $resp): ?>
<div class="box">
  <h3><?= htmlspecialchars($key) ?></h3>
  <?php
    $errCode = $resp['ErrCode'] ?? '?';
    $errMsg  = $resp['ErrMessage'] ?? '';
    if ($errCode === 200): ?>
    <p class="ok">✅ ErrCode: 200</p>
  <?php else: ?>
    <p class="err">❌ ErrCode: <?= $errCode ?> — <?= htmlspecialchars($errMsg) ?></p>
  <?php endif; ?>
  <pre><?= htmlspecialchars(json_encode($resp, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></pre>
</div>
<?php endforeach; ?>

<?php endif; ?>

</body>
</html>
