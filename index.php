<?php
session_start();

define('USUARIO',     'admin');
define('PWD_HASH',    '4188ebcd6a8f3da3aed1ef3a06b00a934656fa17d0ec195f54b45d0c0b548273');
define('SALT',        'cindy_salt_2026');
define('MAX_INTENTOS', 5);
define('BLOQUEO_SEG',  900); // 15 minutos

// ── LOGOUT ──────────────────────────────────────────
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// ── RATE LIMITING ────────────────────────────────────
$ahora       = time();
$intentos    = $_SESSION['login_intentos']     ?? 0;
$ultimoFallo = $_SESSION['login_ultimo_fallo'] ?? 0;
$bloqueado   = ($intentos >= MAX_INTENTOS && ($ahora - $ultimoFallo) < BLOQUEO_SEG);
$restante    = $bloqueado ? ceil((BLOQUEO_SEG - ($ahora - $ultimoFallo)) / 60) : 0;

// ── PROCESAR LOGIN ───────────────────────────────────
$error = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$bloqueado) {
    $user = trim($_POST['username'] ?? '');
    $pwd  = $_POST['password'] ?? '';
    $hash = hash('sha256', $pwd . SALT);
    if ($user === USUARIO && $hash === PWD_HASH) {
        $_SESSION['logged_in']          = true;
        $_SESSION['user']               = $user;
        $_SESSION['login_intentos']     = 0;
        $_SESSION['login_ultimo_fallo'] = 0;
        header('Location: index.php');
        exit;
    }
    $_SESSION['login_intentos']     = $intentos + 1;
    $_SESSION['login_ultimo_fallo'] = $ahora;
    $intentos  = $_SESSION['login_intentos'];
    $bloqueado = ($intentos >= MAX_INTENTOS);
    $restante  = $bloqueado ? ceil(BLOQUEO_SEG / 60) : 0;
    $error     = true;
}

// ── MOSTRAR DASHBOARD SI YA ESTÁ LOGUEADO ───────────
if (!empty($_SESSION['logged_in'])) {
    readfile(__DIR__ . '/dashboard.html');
    exit;
}

// ── MOSTRAR FORMULARIO DE LOGIN ──────────────────────
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acceso — Cindy Mayorista</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1E3A5F 0%, #2d3a8c 100%);
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #fff; border-radius: 16px; padding: 44px 40px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 380px;
  }
  .logo { text-align: center; margin-bottom: 28px; }
  .logo-title { font-size: 20px; font-weight: 800; color: #1E293B; letter-spacing: -0.5px; }
  .logo-sub { font-size: 12px; color: #64748B; margin-top: 2px; }
  label { display: block; font-size: 11px; font-weight: 700; color: #64748B;
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  input[type="text"], input[type="password"] {
    width: 100%; border: 1.5px solid #E2E8F0; border-radius: 8px;
    padding: 11px 14px; font-size: 14px; margin-bottom: 16px; outline: none;
    transition: border-color 0.15s;
  }
  input[type="text"]:focus, input[type="password"]:focus { border-color: #6366F1; }
  button {
    width: 100%; background: #6366F1; color: #fff; border: none;
    border-radius: 8px; padding: 13px; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: background 0.15s; margin-top: 4px;
  }
  button:hover { background: #4F46E5; }
  button:disabled { background: #94A3B8; cursor: not-allowed; }
  .alert {
    border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;
  }
  .alert-error  { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
  .alert-block  { background: #FFF7ED; color: #92400E; border: 1px solid #FED7AA; }
  .intentos-left { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 10px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-title">Cindy Mayorista</div>
    <div class="logo-sub">Dashboard de Ventas</div>
  </div>

  <?php if ($bloqueado): ?>
    <div class="alert alert-block">
      Demasiados intentos fallidos. Intentá de nuevo en <strong><?= $restante ?> minuto<?= $restante > 1 ? 's' : '' ?></strong>.
    </div>
    <button type="button" disabled>Acceso bloqueado</button>
  <?php else: ?>
    <?php if ($error): ?>
      <div class="alert alert-error">
        Usuario o contraseña incorrectos.
        <?php if ($intentos >= 3): ?>
          <br><small>Intentos restantes: <?= MAX_INTENTOS - $intentos ?></small>
        <?php endif; ?>
      </div>
    <?php endif; ?>
    <form method="POST" autocomplete="off">
      <label>Usuario</label>
      <input type="text" name="username" autofocus autocomplete="username">
      <label>Contraseña</label>
      <input type="password" name="password" autocomplete="current-password">
      <button type="submit">Ingresar</button>
    </form>
  <?php endif; ?>
</div>
</body>
</html>
