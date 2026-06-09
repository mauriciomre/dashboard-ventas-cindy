<?php
session_start();
if (empty($_SESSION['logged_in'])) {
    header('Location: ../index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Importar datos — Cindy Mayorista</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #F8FAFC; color: #1E293B; font-size: 14px; min-height: 100vh; }
  .container { max-width: 680px; margin: 40px auto; padding: 0 20px; }
  .card { background: #fff; border-radius: 16px; padding: 40px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-bottom: 20px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 700; margin-bottom: 14px; color: #1E293B; }
  .subtitle { color: #64748B; font-size: 13px; margin-bottom: 28px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #64748B;
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  input[type="file"] {
    width: 100%; border: 1px solid #E2E8F0; border-radius: 8px;
    padding: 10px 14px; font-size: 14px; margin-bottom: 18px; outline: none; }
  input[type="file"]:focus { border-color: #6366F1; }
  button { width: 100%; background: #6366F1; color: #fff; border: none;
    border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: background 0.15s; }
  button:hover { background: #4F46E5; }
  button:disabled { background: #94A3B8; cursor: not-allowed; }
  .status { margin-top: 18px; padding: 14px; border-radius: 8px; font-size: 13px;
    display: none; }
  .status.ok { background: #ECFDF5; color: #065F46; border: 1px solid #6EE7B7; display: block; }
  .status.err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; display: block; }
  .status.info { background: #EEF2FF; color: #3730A3; border: 1px solid #C7D2FE; display: block; }
  .status.warn { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; display: block; }
  .preview { margin-top: 18px; font-size: 12px; color: #64748B;
    background: #F8FAFC; border-radius: 8px; padding: 12px; display: none; }
  .preview table { width: 100%; border-collapse: collapse; }
  .preview th, .preview td { text-align: left; padding: 4px 8px;
    border-bottom: 1px solid #E2E8F0; }
  .preview th { font-weight: 600; color: #1E293B; }
  a.back { display: inline-block; margin-bottom: 20px; color: #6366F1;
    font-size: 13px; text-decoration: none; }
  a.back:hover { text-decoration: underline; }
  /* Log table */
  .log-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .log-table th { text-align: left; padding: 8px 10px; background: #F8FAFC;
    border-bottom: 2px solid #E2E8F0; color: #64748B; font-weight: 600;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  .log-table td { padding: 9px 10px; border-bottom: 1px solid #F1F5F9; }
  .log-table tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px;
    font-weight: 600; background: #DBEAFE; color: #1D4ED8; }
  .empty-log { color: #94A3B8; font-size: 13px; text-align: center; padding: 20px; }
</style>
</head>
<body>
<div class="container">
  <a class="back" href="../">← Volver al dashboard</a>

  <!-- PANEL DE IMPORTACIÓN -->
  <div class="card">
    <h1>Importar datos del ERP</h1>
    <p class="subtitle">Lee la hoja <strong>ZONA PEGAR ERP</strong> del Excel y actualiza la base de datos.</p>

    <label>Archivo Excel</label>
    <input type="file" id="xlFile" accept=".xlsx,.xls">
    <button id="btnImport" onclick="importar()" disabled>Seleccioná un archivo primero</button>
    <div class="status" id="status"></div>
    <div class="preview" id="preview">
      <strong>Vista previa — primeros registros:</strong>
      <div id="preview-table"></div>
    </div>
  </div>

  <!-- HISTORIAL DE IMPORTACIONES -->
  <div class="card">
    <h2>Historial de importaciones</h2>
    <div id="log-container"><p class="empty-log">Cargando...</p></div>
  </div>
</div>

<script>
const API_URL = '../api/importar.php';
const LOG_URL = '../api/import_log.php';

const LOCAL_MAP = {
  '105': 'Peatonal', '5555': 'Peatonal',
  '107': 'Deposito', '113': 'Deposito', '3333': 'Deposito',
  '109': 'R. Indarte', '9999': 'R. Indarte',
  '200': 'Travel Blue'
};

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Habilitar botón al seleccionar archivo ───────────────────────────────────
document.getElementById('xlFile').addEventListener('change', function() {
  const btn = document.getElementById('btnImport');
  if (this.files.length > 0) {
    btn.disabled = false;
    btn.textContent = 'Importar datos';
  }
});

// ─── Parsear ZONA PEGAR ERP ──────────────────────────────────────────────────
function parsearZonaPegar(wb) {
  const ws = wb.Sheets['ZONA PEGAR ERP'];
  if (!ws) throw new Error('No se encontró la hoja "ZONA PEGAR ERP" en el archivo.');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let hIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && String(rows[i][0]).toLowerCase() === 'año') { hIdx = i; break; }
  }
  if (hIdx < 0) throw new Error('No se encontró el encabezado. La primera columna debe decir "Año".');

  const zonaMap = {};
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const a = parseInt(r[0]);
    const m = parseInt(r[1]);
    const lRaw = r[2] ? String(r[2]).trim() : '';
    const l = LOCAL_MAP[lRaw] || lRaw;
    const rubro = r[3] ? String(r[3]).trim() : '';
    const precio = r[5] ? parseFloat(r[5]) : 0;
    const cant   = r[6] ? parseFloat(r[6]) : 0;
    if (!a || !m || !l || !rubro || cant === 0) continue;
    const key = `${a}-${m}-${l}-${rubro}`;
    if (!zonaMap[key]) zonaMap[key] = { a, m, l, r: rubro, v: 0, u: 0 };
    zonaMap[key].v += precio * cant;
    zonaMap[key].u += cant;
  }

  const registros = Object.values(zonaMap);
  if (registros.length === 0) throw new Error('No se encontraron datos en ZONA PEGAR ERP.');
  return registros;
}

// ─── Importar ────────────────────────────────────────────────────────────────
async function importar() {
  const file = document.getElementById('xlFile').files[0];
  const status = document.getElementById('status');
  const btn = document.getElementById('btnImport');

  status.className = 'status info';
  status.textContent = 'Leyendo archivo...';
  btn.disabled = true;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const registros = parsearZonaPegar(wb);
      mostrarPreview(registros.slice(0, 5));

      // Detectar meses que se van a pisar
      const mesesSet = {};
      registros.forEach(r => { mesesSet[`${r.a}-${r.m}`] = {a: r.a, m: r.m}; });
      const mesesLabel = Object.values(mesesSet)
        .sort((a,b) => a.a !== b.a ? a.a - b.a : a.m - b.m)
        .map(x => `${MESES[x.m]} ${x.a}`).join(', ');

      status.className = 'status warn';
      status.textContent = `Importando ${registros.length} registros para: ${mesesLabel}. Si ya existían datos de esos meses serán reemplazados.`;

      await new Promise(r => setTimeout(r, 800));

      status.className = 'status info';
      status.textContent = `Enviando ${registros.length} registros a la base de datos...`;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', data: registros })
      });
      const result = await res.json();

      if (result.ok) {
        status.className = 'status ok';
        status.textContent = `✓ Importación exitosa — ${result.insertados} registros, ${result.meses_actualizados} mes(es) actualizado(s). Ventas mensuales sincronizadas.`;
        cargarHistorial();
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch(err) {
      status.className = 'status err';
      status.textContent = 'Error: ' + err.message;
    }
    btn.disabled = false;
    btn.textContent = 'Importar datos';
  };
  reader.readAsArrayBuffer(file);
}

// ─── Vista previa ─────────────────────────────────────────────────────────────
function mostrarPreview(registros) {
  const preview = document.getElementById('preview');
  const container = document.getElementById('preview-table');
  preview.style.display = 'block';
  container.innerHTML = `
    <table>
      <tr><th>Año</th><th>Mes</th><th>Local</th><th>Rubro</th><th>Valor $</th><th>Unidades</th></tr>
      ${registros.map(r => `
        <tr>
          <td>${r.a}</td><td>${r.m}</td><td>${r.l}</td><td>${r.r}</td>
          <td>$${r.v.toFixed(2)}</td><td>${r.u}</td>
        </tr>`).join('')}
    </table>
    <p style="margin-top:6px;color:#94A3B8">Mostrando los primeros 5 registros parseados.</p>
  `;
}

// ─── Historial ────────────────────────────────────────────────────────────────
async function cargarHistorial() {
  try {
    const res = await fetch(LOG_URL);
    const data = await res.json();
    const container = document.getElementById('log-container');

    if (!data.ok || !data.data.length) {
      container.innerHTML = '<p class="empty-log">Sin importaciones registradas aún.</p>';
      return;
    }

    let html = `<table class="log-table">
      <thead><tr>
        <th>Fecha</th><th>Meses importados</th><th>Registros</th><th>Meses actualizados</th>
      </tr></thead><tbody>`;

    data.data.forEach(row => {
      const fecha = new Date(row.fecha).toLocaleString('es-AR', {
        day:'2-digit', month:'2-digit', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
      const meses = row.meses_texto ? row.meses_texto.split(',').map(m =>
        `<span class="badge">${m.trim()}</span>`).join(' ') : '—';
      html += `<tr>
        <td style="white-space:nowrap;color:#64748B">${fecha}</td>
        <td>${meses}</td>
        <td><strong>${row.registros}</strong></td>
        <td>${row.meses_actualizados}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(e) {
    document.getElementById('log-container').innerHTML =
      '<p class="empty-log" style="color:#F43F5E">Error cargando historial.</p>';
  }
}

cargarHistorial();
</script>
</body>
</html>
