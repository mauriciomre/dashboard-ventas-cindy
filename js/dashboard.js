// =====================================================
// DATOS — cargados desde la API
// =====================================================
let RAW = [];
let DET = [];

const PROJ = [{"a": 2026, "m": 5, "v": 510664260, "inf": 2.5, "season": 0.6183, "prev_v": 339673726}, {"a": 2026, "m": 6, "v": 528417503, "inf": 2.4, "season": 0.6248, "prev_v": 349527559}, {"a": 2026, "m": 7, "v": 767481430, "inf": 2.4, "season": 0.8862, "prev_v": 446239073}, {"a": 2026, "m": 8, "v": 844846884, "inf": 2.3, "season": 0.9536, "prev_v": 476112425}, {"a": 2026, "m": 9, "v": 1022795859, "inf": 2.3, "season": 1.1285, "prev_v": 598152636}, {"a": 2026, "m": 10, "v": 1183219192, "inf": 2.2, "season": 1.2774, "prev_v": 649964256}, {"a": 2026, "m": 11, "v": 1048603602, "inf": 2.2, "season": 1.1077, "prev_v": 480362010}, {"a": 2026, "m": 12, "v": 1746034808, "inf": 2.1, "season": 1.8065, "prev_v": 845608113}, {"a": 2027, "m": 1, "v": 1020069007, "inf": 2.0, "season": 1.0347, "prev_v": 944979914}, {"a": 2027, "m": 2, "v": 1165161918, "inf": 2.0, "season": 1.1587, "prev_v": 705719743}, {"a": 2027, "m": 3, "v": 758060357, "inf": 1.9, "season": 0.7398, "prev_v": 504733260}, {"a": 2027, "m": 4, "v": 693107967, "inf": 1.9, "season": 0.6638, "prev_v": 534871675}];

// =====================================================
// UTILIDADES
// =====================================================
const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n/1e9).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) + 'B';
  if (abs >= 1e6) return '$' + (n/1e6).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + 'M';
  if (abs >= 1e3) return '$' + (n/1e3).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}) + 'k';
  return '$' + n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0});
}

function fmtN(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0});
}

function fmtPct(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '%';
}

function pct(a, b) {
  if (!b || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function deltaClass(v) {
  if (v === null || v === undefined) return 'neu';
  return v >= 0 ? 'pos' : 'neg';
}

function getUniqueYears() {
  const sy = new Set(RAW.map(d => d.año));
  DET.forEach(d => sy.add(d.a));
  return [...sy].sort();
}

function getUniqueLocales() {
  return [...new Set(DET.map(d => d.l))].sort();
}

function getUniqueRubros() {
  return [...new Set(DET.map(d => d.r))].sort();
}

// =====================================================
// DETECCION ULTIMO MES VENCIDO
// =====================================================
function detectLastCompletedMonth() {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  const detMonths = {};
  DET.forEach(d => {
    if (d.a === añoActual && d.m === mesActual) return;
    const key = d.a + '-' + d.m;
    if (!detMonths[key]) detMonths[key] = {año:d.a, mes:d.m, total:0, uds:0};
    detMonths[key].total += d.v;
    detMonths[key].uds += d.u;
  });

  const rawMonths = RAW.filter(d => !(d.año===añoActual && d.mes===mesActual) && d.total>0)
    .map(d => ({año:d.año, mes:d.mes, total:d.total}));

  const all = [...rawMonths];
  Object.values(detMonths).forEach(dm => {
    if (!all.find(r => r.año===dm.año && r.mes===dm.mes)) all.push(dm);
  });
  all.sort((a,b) => a.año!==b.año ? a.año-b.año : a.mes-b.mes);
  
  const last = all[all.length-1];
  // merge DET data
  const dm = detMonths[last.año+'-'+last.mes];
  if (dm) {
    last.total = dm.total;
    last.uds = dm.uds;
  }
  return last;
}

function getDetMonthTotals(a, m) {
  let v = 0, u = 0;
  DET.forEach(d => { if (d.a===a && d.m===m) { v+=d.v; u+=d.u; } });
  return {v, u};
}

function getRawMonthTotal(a, m) {
  const r = RAW.find(d => d.año===a && d.mes===m);
  return r ? r.total : null;
}

// =====================================================
// INICIALIZAR BANNER
// =====================================================
function initBanner() {
  const last = detectLastCompletedMonth();
  const {año, mes} = last;
  
  document.getElementById('banner-month-title').textContent = MESES[mes] + ' ' + año;
  
  // Current month data (from DET)
  const curr = getDetMonthTotals(año, mes);
  const currV = curr.v;
  const currU = curr.u;
  
  // Same month prev year
  const prev12V = getDetMonthTotals(año-1, mes).v || getRawMonthTotal(año-1, mes) || 0;
  const prev12U = getDetMonthTotals(año-1, mes).u || 0;
  
  // Previous month
  let prevM = mes - 1, prevA = año;
  if (prevM === 0) { prevM = 12; prevA--; }
  const prevMonV = getDetMonthTotals(prevA, prevM).v || getRawMonthTotal(prevA, prevM) || 0;
  const prevMonU = getDetMonthTotals(prevA, prevM).u || 0;
  
  // YoY delta
  const dYoYv = pct(currV, prev12V);
  const dYoYu = pct(currU, prev12U);
  const dMoMv = pct(currV, prevMonV);
  const dMoMu = pct(currU, prevMonU);
  
  document.getElementById('bm-ventas').textContent = fmt(currV);
  document.getElementById('bm-ventas-sub').textContent = 'Fuente ERP — venta_con';
  
  document.getElementById('bm-yoy-v').textContent = fmt(currV - prev12V);
  const yoyVEl = document.getElementById('bm-yoy-v-pct');
  yoyVEl.textContent = fmtPct(dYoYv);
  yoyVEl.className = 'bm-delta ' + deltaClass(dYoYv);
  
  document.getElementById('bm-mom-v').textContent = fmt(currV - prevMonV);
  const momVEl = document.getElementById('bm-mom-v-pct');
  momVEl.textContent = fmtPct(dMoMv);
  momVEl.className = 'bm-delta ' + deltaClass(dMoMv);
  
  document.getElementById('bm-uds').textContent = fmtN(currU);
  document.getElementById('bm-uds-sub').textContent = 'unidades — ERP';

  document.getElementById('bm-yoy-u').textContent = fmtN(currU - prev12U);
  const yoyUEl = document.getElementById('bm-yoy-u-pct');
  yoyUEl.textContent = fmtPct(dYoYu);
  yoyUEl.className = 'bm-delta ' + deltaClass(dYoYu);

  document.getElementById('bm-mom-u').textContent = fmtN(currU - prevMonU);
  const momUEl = document.getElementById('bm-mom-u-pct');
  momUEl.textContent = fmtPct(dMoMu);
  momUEl.className = 'bm-delta ' + deltaClass(dMoMu);
  
  document.getElementById('data-date').textContent = MESES[mes] + ' ' + año;
}

// =====================================================
// CONTROLES
// =====================================================
let currentVista = 'mensual';
let currentDesde, currentHasta, currentComparar;

function initControls() {
  const years      = getUniqueYears();
  const lastYear   = years[years.length - 1];
  const secondLast = years.length >= 2 ? years[years.length - 2] : years[0];

  // Build option HTML strings once — avoids repeated layout thrashing from innerHTML +=
  const yearOpts    = years.map(y => `<option value="${y}">${y}</option>`).join('');
  const yearOptsRev = [...years].reverse().map(y => `<option value="${y}">${y}</option>`).join('');

  const desdeEl   = document.getElementById('ctrl-desde');
  const hastaEl   = document.getElementById('ctrl-hasta');
  const compEl    = document.getElementById('ctrl-comparar');
  const evoCmpEl  = document.getElementById('evo-comparar');

  desdeEl.innerHTML  = yearOpts;
  hastaEl.innerHTML  = yearOpts;
  compEl.innerHTML   = yearOpts;
  evoCmpEl.innerHTML = '<option value="">Sin comparar</option>' + yearOpts;

  hastaEl.value  = lastYear;
  desdeEl.value  = Math.max(years[0], lastYear - 4);
  compEl.value   = secondLast;
  evoCmpEl.value = '';

  currentDesde    = parseInt(desdeEl.value);
  currentHasta    = parseInt(hastaEl.value);
  currentComparar = parseInt(compEl.value);

  // Charts & tables year selectors
  const localYearEl = document.getElementById('local-year');
  const rubroYearEl = document.getElementById('rubro-year');
  const udsAEl      = document.getElementById('uds-año-a');
  const udsBEl      = document.getElementById('uds-año-b');
  const erpAnoEl    = document.getElementById('erp-año');
  const tblAnoEl    = document.getElementById('tbl-año');

  localYearEl.innerHTML = yearOpts;
  rubroYearEl.innerHTML = yearOpts;
  udsAEl.innerHTML      = yearOpts;
  udsBEl.innerHTML      = yearOpts;
  erpAnoEl.innerHTML    = yearOpts;
  tblAnoEl.innerHTML    = yearOpts;

  localYearEl.value = lastYear;
  rubroYearEl.value = lastYear;   // synced with localYearEl by default
  udsAEl.value      = lastYear;
  udsBEl.value      = secondLast;
  erpAnoEl.value    = lastYear;
  tblAnoEl.value    = lastYear;

  // Sync local-year ↔ rubro-year bidirectionally (task #18)
  localYearEl.addEventListener('change', () => {
    rubroYearEl.value = localYearEl.value;
    renderLocalChart();
    renderRubroChart();
  });
  rubroYearEl.addEventListener('change', () => {
    localYearEl.value = rubroYearEl.value;
    renderLocalChart();
    renderRubroChart();
  });

  // Lists built once
  const locales     = getUniqueLocales();
  const uniqueRubros = [...new Set(DET.map(d => d.r))].sort();
  const rawYears    = [...new Set(RAW.map(d => d.año))].sort((a, b) => b - a);

  const localOpts = locales.map(l => `<option value="${l}">${l}</option>`).join('');
  const rubroOpts = uniqueRubros.map(r => `<option value="${r}">${r}</option>`).join('');

  document.getElementById('erp-local').innerHTML   = '<option value="">Todos</option>' + localOpts;
  document.getElementById('erp-rubro').innerHTML   = '<option value="">Todos</option>' + rubroOpts;
  document.getElementById('uds-local-f').innerHTML = '<option value="">Todos</option>' + localOpts;

  const tblEvoComp = document.getElementById('tbl-evo-comp');
  const tblEvoArt  = document.getElementById('tbl-evo-articulos');
  tblEvoComp.innerHTML = rawYears.map(y => `<option value="${y}">${y}</option>`).join('');
  tblEvoArt.innerHTML  = rubroOpts;
}

function setVista(btn) {
  document.querySelectorAll('.vista-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentVista = btn.dataset.vista;
}

function applyFilters() {
  currentDesde = parseInt(document.getElementById('ctrl-desde').value);
  currentHasta = parseInt(document.getElementById('ctrl-hasta').value);
  currentComparar = parseInt(document.getElementById('ctrl-comparar').value);
  renderEvoChart();
  renderEvoTable();
  renderKPIs();
}

// =====================================================
// KPIs
// =====================================================
function renderKPIs() {
  const last = detectLastCompletedMonth();
  const {año, mes} = last;
  
  const currV = getDetMonthTotals(año, mes).v;
  const prev12V = getDetMonthTotals(año-1, mes).v || getRawMonthTotal(año-1, mes) || 0;
  const dYoY = pct(currV, prev12V);
  
  document.getElementById('kpi-ultmes').textContent = fmt(currV);
  document.getElementById('kpi-ultmes-d').textContent = MESES[mes] + ' ' + año;
  document.getElementById('kpi-ultmes-d').className = 'kpi-delta neu';
  
  document.getElementById('kpi-yoy').textContent = fmtPct(dYoY);
  document.getElementById('kpi-yoy').style.color = dYoY >= 0 ? 'var(--secondary)' : 'var(--danger)';
  document.getElementById('kpi-yoy-d').textContent = fmt(currV - prev12V);
  document.getElementById('kpi-yoy-d').className = 'kpi-delta ' + deltaClass(dYoY);
  document.getElementById('kpi-yoy-sub').textContent = 'vs ' + MESES[mes] + ' ' + (año-1);
  
  // Acumulado: sum all months in current year (up to last vencido) vs same months prev year
  const currentYear = año;
  let acumCurr = 0, acumPrev = 0;
  for (let m2 = 1; m2 <= mes; m2++) {
    const cv = getDetMonthTotals(currentYear, m2).v || getRawMonthTotal(currentYear, m2) || 0;
    const pv = getDetMonthTotals(currentYear-1, m2).v || getRawMonthTotal(currentYear-1, m2) || 0;
    acumCurr += cv;
    acumPrev += pv;
  }
  const dAcum = pct(acumCurr, acumPrev);
  document.getElementById('kpi-acum').textContent = fmt(acumCurr);
  document.getElementById('kpi-acum-d').textContent = fmtPct(dAcum) + ' vs mismo periodo ' + (currentYear-1);
  document.getElementById('kpi-acum-d').className = 'kpi-delta ' + deltaClass(dAcum);
  document.getElementById('kpi-acum-sub').textContent = 'Ene—' + MESES_CORTO[mes] + ' ' + currentYear;
  
  // Canal lider: from RAW last entry locales
  const rawLast = RAW.filter(d => d.año===año && d.mes===mes);
  let localesSums = {};
  DET.filter(d => d.a===año && d.m===mes).forEach(d => {
    localesSums[d.l] = (localesSums[d.l]||0) + d.v;
  });
  if (Object.keys(localesSums).length === 0 && rawLast.length > 0) {
    localesSums = rawLast[0].locales || {};
  }
  let canalLider = '—', canalV = 0;
  Object.entries(localesSums).forEach(([k,v]) => { if(v>canalV){canalV=v;canalLider=k;} });
  document.getElementById('kpi-canal').textContent = canalLider;
  document.getElementById('kpi-canal-d').textContent = fmt(canalV);
  document.getElementById('kpi-canal-sub').textContent = 'mayor volumen ' + MESES[mes] + ' ' + año;
  
  // Proyeccion anual
  const projTotal = PROJ.reduce((s,p) => s+p.v, 0);
  document.getElementById('kpi-proj').textContent = fmt(projTotal);
  document.getElementById('kpi-proj-d').textContent = 'May 2026 — Abr 2027';

  // Mes en curso: mes calendario actual (con datos embebidos del Excel)
  const _hoy = new Date();
  const cursoAno = _hoy.getFullYear();
  const cursoMes = _hoy.getMonth() + 1;
  const cursoTotals = getDetMonthTotals(cursoAno, cursoMes);
  // Si no hay datos del mes actual, mostrar el último mes disponible
  const _cursoV = cursoTotals.v > 0 ? cursoTotals.v : getDetMonthTotals(año, mes).v;
  const _cursoU = cursoTotals.u > 0 ? cursoTotals.u : getDetMonthTotals(año, mes).u;
  const _cursoLabel = cursoTotals.v > 0 ? (MESES[cursoMes] + ' ' + cursoAno) : (MESES[mes] + ' ' + año);
  document.getElementById('kpi-curso-v').textContent = '$ ' + fmt(_cursoV);
  document.getElementById('kpi-curso-u').textContent = fmtN(_cursoU) + ' Unid.';
  document.getElementById('kpi-curso-sub').textContent = _cursoLabel + ' — facturado';
}

// =====================================================
// PALETA DE COLORES
// =====================================================
const PALETTE = [
  '#6366F1','#10B981','#F59E0B','#F43F5E','#8B5CF6',
  '#06B6D4','#84CC16','#EC4899','#14B8A6','#F97316',
  '#A78BFA','#34D399','#FCD34D','#FB7185','#60A5FA',
  '#4ADE80','#FACC15','#F87171','#38BDF8','#C084FC'
];

function colorAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// =====================================================
// CHART: EVOLUCION
// =====================================================
let chartEvo = null;

function getFilteredRaw() {
  const rawMonths = RAW.filter(d => d.año >= currentDesde && d.año <= currentHasta && d.total > 0);
  // Add DET-only months (not present in RAW) within the same range
  const rawKeys = new Set(rawMonths.map(d => d.año+'-'+d.mes));
  const detExtra = [];
  const detSeen = new Set();
  DET.forEach(d => {
    const key = d.a+'-'+d.m;
    if (d.a >= currentDesde && d.a <= currentHasta && !rawKeys.has(key) && !detSeen.has(key)) {
      detSeen.add(key);
      const tot = DET.filter(x=>x.a===d.a&&x.m===d.m).reduce((s,x)=>s+x.v,0);
      if (tot > 0) detExtra.push({año:d.a, mes:d.m, total:tot});
    }
  });
  return [...rawMonths, ...detExtra];
}

function renderEvoTable() {
  const compYear = document.getElementById('tbl-evo-comp').value ? parseInt(document.getElementById('tbl-evo-comp').value) : null;
  const rubroFiltro = document.getElementById('tbl-evo-articulos').value;
  const showAll = rubroFiltro === 'todos';

  // Build month list from filtered RAW
  const filtered = getFilteredRaw().sort((a,b) => a.año!==b.año ? a.año-b.año : a.mes-b.mes);
  if (!filtered.length) { document.getElementById('evo-table-container').innerHTML = '<p style="color:var(--text-muted);padding:12px">Sin datos</p>'; return; }

  // Aggregate units from DET by (año, mes, rubro)
  function getUnits(año, mes) {
    return DET.filter(d => d.a===año && d.m===mes && (showAll || d.r===rubroFiltro))
              .reduce((s,d) => s+d.u, 0);
  }
  function getVentas(año, mes) {
    if (!showAll) {
      return DET.filter(d => d.a===año && d.m===mes && d.r===rubroFiltro).reduce((s,d)=>s+d.v,0);
    }
    const r = RAW.find(d => d.año===año && d.mes===mes);
    if (r) return r.total;
    // Fallback: sum from DET for months not in RAW (ej: mes en curso)
    return DET.filter(d => d.a===año && d.m===mes).reduce((s,d)=>s+d.v,0);
  }

  const hasComp = !!compYear;
  const MESES_N = {1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre'};

  let html = `<table class="data-table"><thead><tr>
    <th>Mes</th>
    <th class="num">Ventas $</th>
    <th class="num">Artículos</th>
    <th class="num">Ticket Prom.</th>`;
  if (hasComp) {
    html += `<th class="num">Ventas $ ${compYear}</th>
    <th class="num">Var. Ventas %</th>
    <th class="num">Artículos ${compYear}</th>
    <th class="num">Var. Art. %</th>`;
  }
  html += `</tr></thead><tbody>`;

  let totV=0, totU=0, totVc=0, totUc=0;
  filtered.forEach(d => {
    const v = getVentas(d.año, d.mes);
    const u = getUnits(d.año, d.mes);
    const ticket = u > 0 ? v/u : 0;
    totV += v; totU += u;

    html += `<tr>
      <td><strong>${MESES_N[d.mes]} ${d.año}</strong></td>
      <td class="num">${fmt(v)}</td>
      <td class="num">${fmtN(u)}</td>
      <td class="num">${fmt(ticket)}</td>`;

    if (hasComp) {
      const vc = getVentas(compYear, d.mes);
      const uc = getUnits(compYear, d.mes);
      totVc += vc; totUc += uc;
      const dv = vc > 0 ? ((v-vc)/vc*100) : null;
      const du = uc > 0 ? ((u-uc)/uc*100) : null;
      const dvStr = dv!==null ? `<span style="color:${dv>=0?'#059669':'#F43F5E'};font-weight:600">${dv>=0?'+':''}${dv.toFixed(1)}%</span>` : '—';
      const duStr = du!==null ? `<span style="color:${du>=0?'#059669':'#F43F5E'};font-weight:600">${du>=0?'+':''}${du.toFixed(1)}%</span>` : '—';
      html += `<td class="num" style="color:var(--text-muted)">${fmt(vc)}</td>
      <td class="num">${dvStr}</td>
      <td class="num" style="color:var(--text-muted)">${fmtN(uc)}</td>
      <td class="num">${duStr}</td>`;
    }
    html += `</tr>`;
  });

  // Fila total
  const totTicket = totU > 0 ? totV/totU : 0;
  html += `<tr style="background:#EFF6FF;font-weight:700">
    <td>TOTAL</td>
    <td class="num">${fmt(totV)}</td>
    <td class="num">${fmtN(totU)}</td>
    <td class="num">${fmt(totTicket)}</td>`;
  if (hasComp) {
    const dv = totVc>0?((totV-totVc)/totVc*100):null;
    const du = totUc>0?((totU-totUc)/totUc*100):null;
    const dvStr = dv!==null?`<span style="color:${dv>=0?'#059669':'#F43F5E'}">${dv>=0?'+':''}${dv.toFixed(1)}%</span>`:'—';
    const duStr = du!==null?`<span style="color:${du>=0?'#059669':'#F43F5E'}">${du>=0?'+':''}${du.toFixed(1)}%</span>`:'—';
    html += `<td class="num">${fmt(totVc)}</td><td class="num">${dvStr}</td><td class="num">${fmtN(totUc)}</td><td class="num">${duStr}</td>`;
  }
  html += `</tr></tbody></table>`;
  document.getElementById('evo-table-container').innerHTML = html;
}

function renderEvoChart() {
  const tipo = document.getElementById('evo-tipo').value;
  const compYear = document.getElementById('evo-comparar').value;
  const vista = currentVista;
  
  let labels = [], data1 = [], data2 = [];
  
  if (vista === 'mensual') {
    const filtered = getFilteredRaw().sort((a,b) => a.año!==b.año ? a.año-b.año : a.mes-b.mes);
    labels = filtered.map(d => MESES_CORTO[d.mes] + "'" + String(d.año).slice(2));
    data1 = filtered.map(d => d.total);
    
    if (compYear) {
      const compY = parseInt(compYear);
      data2 = filtered.map(d => {
        const r = RAW.find(x => x.año===compY && x.mes===d.mes);
        return r ? r.total : null;
      });
    }
  } else {
    // Anual: RAW + meses DET no cubiertos por RAW
    const byYear = {};
    const rawKeys = new Set(RAW.map(d => d.año+'-'+d.mes));
    RAW.filter(d => d.año >= currentDesde && d.año <= currentHasta).forEach(d => {
      byYear[d.año] = (byYear[d.año]||0) + d.total;
    });
    DET.filter(d => d.a >= currentDesde && d.a <= currentHasta && !rawKeys.has(d.a+'-'+d.m)).forEach(d => {
      byYear[d.a] = (byYear[d.a]||0) + d.v;
    });
    const years = Object.keys(byYear).sort();
    labels = years;
    data1 = years.map(y => byYear[y]);
  }
  
  if (chartEvo) chartEvo.destroy();
  
  const ctx = document.getElementById('chart-evo').getContext('2d');
  const datasets = [{
    label: 'Ventas ' + currentDesde + (currentDesde!==currentHasta?'-'+currentHasta:''),
    data: data1,
    borderColor: '#6366F1',
    backgroundColor: tipo === 'bar' ? colorAlpha('#6366F1', 0.7) : colorAlpha('#6366F1', 0.1),
    fill: tipo === 'line',
    tension: 0.4,
    pointRadius: tipo === 'line' ? 3 : 0,
    borderWidth: 2
  }];
  
  if (compYear && data2.length) {
    datasets.push({
      label: 'Ventas ' + compYear,
      data: data2,
      borderColor: '#F59E0B',
      backgroundColor: tipo === 'bar' ? colorAlpha('#F59E0B', 0.6) : colorAlpha('#F59E0B', 0.08),
      fill: false,
      tension: 0.4,
      pointRadius: tipo === 'line' ? 3 : 0,
      borderWidth: 2,
      borderDash: [5,3]
    });
  }
  
  chartEvo = new Chart(ctx, {
    type: tipo === 'bar' ? 'bar' : 'line',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: {
          grid: { color: '#F1F5F9' },
          ticks: { font: { size: 10 }, callback: v => fmt(v) }
        }
      }
    }
  });
}

// =====================================================
// CHART: LOCAL (barras apiladas)
// =====================================================
let chartLocal = null;

function renderLocalChart() {
  const year = parseInt(document.getElementById('local-year').value);
  const filtered = RAW.filter(d => d.año === year && Object.keys(d.locales||{}).length > 0)
    .sort((a,b) => a.mes-b.mes);
  
  const locales = [...new Set(filtered.flatMap(d => Object.keys(d.locales||{})))].sort();
  const labels = filtered.map(d => MESES_CORTO[d.mes]);
  
  const datasets = locales.map((loc, i) => ({
    label: loc,
    data: filtered.map(d => d.locales[loc] || 0),
    backgroundColor: colorAlpha(PALETTE[i % PALETTE.length], 0.8),
    borderColor: PALETTE[i % PALETTE.length],
    borderWidth: 1
  }));
  
  if (chartLocal) chartLocal.destroy();
  const ctx = document.getElementById('chart-local').getContext('2d');
  chartLocal = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmt(v) } }
      }
    }
  });
}

// =====================================================
// CHART: RUBRO (barras apiladas - unidades desde RAW)
// =====================================================
let chartRubro = null;

function renderRubroChart() {
  const year = parseInt(document.getElementById('rubro-year').value);
  const filtered = DET.filter(d => d.a === year);

  const meses = [...new Set(filtered.map(d => d.m))].sort((a, b) => a - b);
  const rubros = [...new Set(filtered.map(d => d.r))].sort();
  const labels = meses.map(m => MESES_CORTO[m]);

  const datasets = rubros.map((r, i) => ({
    label: r,
    data: meses.map(m =>
      filtered.filter(d => d.m === m && d.r === r).reduce((s, d) => s + (d.u || 0), 0)
    ),
    backgroundColor: colorAlpha(PALETTE[i % PALETTE.length], 0.8),
    borderColor: PALETTE[i % PALETTE.length],
    borderWidth: 1
  }));
  
  if (chartRubro) chartRubro.destroy();
  const ctx = document.getElementById('chart-rubro').getContext('2d');
  chartRubro = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtN(ctx.raw) + ' uds' } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtN(v) } }
      }
    }
  });
}

// =====================================================
// CHARTS: UNIDADES COMPARATIVO
// =====================================================
let chartUdsRanking = null, chartUdsYoy = null, chartUdsEvo = null, chartUdsTorta = null;

function getDetFiltered(a, localF) {
  return DET.filter(d => d.a === a && (!localF || d.l === localF));
}

function renderUdsCharts() {
  const anoA = parseInt(document.getElementById('uds-año-a').value);
  const anoB = parseInt(document.getElementById('uds-año-b').value);
  const localF = document.getElementById('uds-local-f').value;
  
  // RANKING by rubro
  const rubros = getUniqueRubros();
  const udsA = {}, udsB = {};
  getDetFiltered(anoA, localF).forEach(d => { udsA[d.r] = (udsA[d.r]||0) + d.u; });
  getDetFiltered(anoB, localF).forEach(d => { udsB[d.r] = (udsB[d.r]||0) + d.u; });
  
  const rankRubros = [...new Set([...Object.keys(udsA),...Object.keys(udsB)])].sort((a,b) => (udsA[b]||0)-(udsA[a]||0));
  
  if (chartUdsRanking) chartUdsRanking.destroy();
  const ctxR = document.getElementById('chart-uds-ranking').getContext('2d');
  chartUdsRanking = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: rankRubros,
      datasets: [
        { label: String(anoA), data: rankRubros.map(r => udsA[r]||0), backgroundColor: colorAlpha('#6366F1', 0.8), borderColor: '#6366F1', borderWidth: 1 },
        { label: String(anoB), data: rankRubros.map(r => udsB[r]||0), backgroundColor: colorAlpha('#10B981', 0.7), borderColor: '#10B981', borderWidth: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtN(ctx.raw) + ' uds' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtN(v) } }
      }
    }
  });
  
  // YOY comparison by rubro
  const yoyRubros = rankRubros.filter(r => udsB[r] && udsB[r] > 0);
  const yoyData = yoyRubros.map(r => pct(udsA[r]||0, udsB[r]||1));
  
  if (chartUdsYoy) chartUdsYoy.destroy();
  const ctxY = document.getElementById('chart-uds-yoy').getContext('2d');
  chartUdsYoy = new Chart(ctxY, {
    type: 'bar',
    data: {
      labels: yoyRubros,
      datasets: [{
        label: 'Variacion % ' + anoA + ' vs ' + anoB,
        data: yoyData,
        backgroundColor: yoyData.map(v => v>=0 ? colorAlpha('#10B981',0.8) : colorAlpha('#F43F5E',0.8)),
        borderColor: yoyData.map(v => v>=0 ? '#10B981' : '#F43F5E'),
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmtPct(ctx.raw) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtPct(v) } }
      }
    }
  });
  
  // EVOLUCION mensual total uds
  const meses12A = [], meses12B = [];
  for (let m = 1; m <= 12; m++) {
    const sumA = getDetFiltered(anoA, localF).filter(d => d.m===m).reduce((s,d)=>s+d.u,0);
    const sumB = getDetFiltered(anoB, localF).filter(d => d.m===m).reduce((s,d)=>s+d.u,0);
    meses12A.push(sumA || null);
    meses12B.push(sumB || null);
  }
  
  if (chartUdsEvo) chartUdsEvo.destroy();
  const ctxE = document.getElementById('chart-uds-evo').getContext('2d');
  chartUdsEvo = new Chart(ctxE, {
    type: 'line',
    data: {
      labels: MESES_CORTO.slice(1),
      datasets: [
        { label: String(anoA), data: meses12A, borderColor: '#6366F1', backgroundColor: colorAlpha('#6366F1',0.1), fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
        { label: String(anoB), data: meses12B, borderColor: '#F59E0B', backgroundColor: colorAlpha('#F59E0B',0.05), fill: false, tension: 0.4, pointRadius: 4, borderWidth: 2, borderDash: [5,3] }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtN(ctx.raw) + ' uds' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtN(v) } }
      }
    }
  });
  
  // TORTA por rubro (anoA)
  const torta = Object.entries(udsA).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if (chartUdsTorta) chartUdsTorta.destroy();
  const ctxT = document.getElementById('chart-uds-torta').getContext('2d');
  chartUdsTorta = new Chart(ctxT, {
    type: 'doughnut',
    data: {
      labels: torta.map(([r])=>r),
      datasets: [{
        data: torta.map(([,v])=>v),
        backgroundColor: PALETTE.map(c => colorAlpha(c, 0.8)),
        borderColor: PALETTE,
        borderWidth: 2
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmtN(ctx.raw) + ' uds (' + fmtPct(ctx.parsed/torta.reduce((s,[,v])=>s+v,0)*100) + ')' } }
      }
    }
  });
}

// =====================================================
// HEATMAP ERP
// =====================================================
function getHeatmapColor(v, min, max) {
  if (v === 0 || max === 0) return '#F8FAFC';
  const ratio = (v - min) / (max - min || 1);
  const r = Math.round(219 + (99-219)*ratio);
  const g = Math.round(234 + (102-234)*ratio);
  const b = Math.round(254 + (241-254)*ratio);
  return `rgb(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))})`;
}

let chartErpRanking = null;

function renderErpCharts() {
  const anoErp = parseInt(document.getElementById('erp-año').value);
  const localErp = document.getElementById('erp-local').value;
  const rubroErp = document.getElementById('erp-rubro').value;
  const metrica = document.getElementById('erp-metrica').value;

  const filtered = DET.filter(d => d.a===anoErp && (!localErp || d.l===localErp) && (!rubroErp || d.r===rubroErp) && d.r && d.r.toLowerCase()!=='total');

  // Aggregate by (rubro, mes)
  const rubros = [...new Set(filtered.map(d=>d.r))].sort();
  const pivot = {};
  rubros.forEach(r => {
    pivot[r] = {};
    for (let m=1;m<=12;m++) pivot[r][m]=0;
  });
  filtered.forEach(d => {
    if (pivot[d.r]) pivot[d.r][d.m] += metrica==='v' ? d.v : d.u;
  });
  
  // HEATMAP
  const allVals = Object.values(pivot).flatMap(row => Object.values(row)).filter(v=>v>0);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  
  let hmHTML = `<table class="heatmap-table"><thead><tr><th>Rubro</th>`;
  for (let m=1;m<=12;m++) hmHTML += `<th>${MESES_CORTO[m]}</th>`;
  hmHTML += '<th>Total</th></tr></thead><tbody>';
  
  rubros.forEach(r => {
    const rowTotal = Object.values(pivot[r]).reduce((s,v)=>s+v,0);
    hmHTML += `<tr><td class="row-header">${r}</td>`;
    for (let m=1;m<=12;m++) {
      const v = pivot[r][m];
      const bg = getHeatmapColor(v, minV, maxV);
      const txt = metrica==='v' ? fmt(v) : fmtN(v);
      hmHTML += `<td class="hm-cell" style="background:${bg};font-size:11px">${v>0?txt:'—'}</td>`;
    }
    hmHTML += `<td style="font-weight:700;font-size:12px">${metrica==='v'?fmt(rowTotal):fmtN(rowTotal)}</td>`;
    hmHTML += '</tr>';
  });
  // Fila TOTAL por mes
  hmHTML += `<tr style="background:#EFF6FF;font-weight:700"><td class="row-header">TOTAL</td>`;
  let grandHmTotal = 0;
  for (let m=1;m<=12;m++) {
    const colTotal = rubros.reduce((s,r)=>s+(pivot[r][m]||0),0);
    grandHmTotal += colTotal;
    hmHTML += `<td class="hm-cell" style="font-size:11px;font-weight:700">${colTotal>0?(metrica==='v'?fmt(colTotal):fmtN(colTotal)):'—'}</td>`;
  }
  hmHTML += `<td style="font-weight:700;font-size:12px">${metrica==='v'?fmt(grandHmTotal):fmtN(grandHmTotal)}</td></tr>`;
  hmHTML += '</tbody></table>';
  document.getElementById('heatmap-container').innerHTML = hmHTML;
  
  // PIVOT (por mes)
  const locales = localErp ? [localErp] : [...new Set(DET.filter(d=>d.a===anoErp).map(d=>d.l))].sort();
  const pivotMes = {};
  for (let m=1;m<=12;m++) {
    pivotMes[m] = {};
    locales.forEach(l => {
      pivotMes[m][l] = 0;
    });
  }
  DET.filter(d=>d.a===anoErp && (!localErp||d.l===localErp) && (!rubroErp||d.r===rubroErp) && d.r && d.r.toLowerCase()!=='total').forEach(d=>{
    if(pivotMes[d.m] && pivotMes[d.m][d.l]!==undefined) pivotMes[d.m][d.l] += metrica==='v'?d.v:d.u;
  });
  
  let pvHTML = `<table class="data-table"><thead><tr><th>Mes</th>`;
  locales.forEach(l => pvHTML += `<th class="num">${l}</th>`);
  pvHTML += '<th class="num">Total</th></tr></thead><tbody>';
  
  let grandTotal = 0;
  for (let m=1;m<=12;m++) {
    const rowVals = locales.map(l=>pivotMes[m][l]||0);
    const rowTotal = rowVals.reduce((s,v)=>s+v,0);
    grandTotal += rowTotal;
    if (rowTotal === 0) continue;
    pvHTML += `<tr><td>${MESES[m]}</td>`;
    rowVals.forEach(v => pvHTML += `<td class="num">${metrica==='v'?fmt(v):fmtN(v)}</td>`);
    pvHTML += `<td class="num" style="font-weight:700">${metrica==='v'?fmt(rowTotal):fmtN(rowTotal)}</td>`;
    pvHTML += '</tr>';
  }
  pvHTML += `<tr style="background:#EFF6FF;font-weight:700"><td>TOTAL</td>`;
  locales.forEach(l => {
    const t = Object.values(pivotMes).reduce((s,m2)=>s+(m2[l]||0),0);
    pvHTML += `<td class="num">${metrica==='v'?fmt(t):fmtN(t)}</td>`;
  });
  pvHTML += `<td class="num">${metrica==='v'?fmt(grandTotal):fmtN(grandTotal)}</td></tr>`;
  pvHTML += '</tbody></table>';
  document.getElementById('pivot-container').innerHTML = pvHTML;
  
  // RANKING chart
  const rankData = rubros.map(r => ({
    r,
    v: Object.values(pivot[r]).reduce((s,x)=>s+x,0)
  })).sort((a,b)=>b.v-a.v).slice(0,15);
  
  if (chartErpRanking) chartErpRanking.destroy();
  const ctxR = document.getElementById('chart-erp-ranking').getContext('2d');
  chartErpRanking = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: rankData.map(d=>d.r),
      datasets: [{
        label: metrica==='v'?'Ventas $':'Unidades',
        data: rankData.map(d=>d.v),
        backgroundColor: PALETTE.map(c=>colorAlpha(c,0.8)),
        borderColor: PALETTE,
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => metrica==='v'?fmt(ctx.raw):fmtN(ctx.raw)+' uds' } }
      },
      scales: {
        x: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => metrica==='v'?fmt(v):fmtN(v) } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });

  // COMPARATIVA: año seleccionado vs año anterior por rubro
  const anoAnt = anoErp - 1;
  const filteredAnt = DET.filter(d => d.a===anoAnt && (!localErp || d.l===localErp));
  const allRubros = [...new Set([
    ...filtered.map(d=>d.r),
    ...filteredAnt.map(d=>d.r)
  ])].sort();

  const totAct = {}, totAnt = {};
  allRubros.forEach(r => { totAct[r]=0; totAnt[r]=0; });
  filtered.forEach(d => { if(totAct[d.r]!==undefined) totAct[d.r] += metrica==='v'?d.v:d.u; });
  filteredAnt.forEach(d => { if(totAnt[d.r]!==undefined) totAnt[d.r] += metrica==='v'?d.v:d.u; });

  const grandAct = allRubros.reduce((s,r)=>s+totAct[r],0);
  const grandAntT = allRubros.reduce((s,r)=>s+totAnt[r],0);
  const grandDelta = grandAct - grandAntT;
  const grandPct = grandAntT>0?((grandDelta/grandAntT)*100):null;

  let cmpHTML = `<table class="data-table">
    <thead><tr>
      <th>Rubro</th>
      <th class="num">${anoErp}</th>
      <th class="num">${anoAnt}</th>
      <th class="num">Var. ${metrica==='v'?'$':'Uds'}</th>
      <th class="num">Var. %</th>
      <th class="num">Part. % (${anoErp})</th>
    </tr></thead><tbody>`;

  allRubros
    .map(r => ({ r, act: totAct[r], ant: totAnt[r], delta: totAct[r]-totAnt[r] }))
    .sort((a,b)=>b.act-a.act)
    .forEach(({r, act, ant, delta}) => {
      const pct = ant>0?((delta/ant)*100):null;
      const part = grandAct>0?((act/grandAct)*100):0;
      const pctColor = delta>=0?'color:#059669':'color:#F43F5E';
      const pctStr = pct!==null
        ? `<span style="${pctColor};font-weight:700">${delta>=0?'+':''}${pct.toFixed(1)}%</span>`
        : `<span style="color:var(--text-muted)">N/A</span>`;
      const deltaStr = metrica==='v'
        ? `<span style="${pctColor}">${delta>=0?'+':''}${fmt(delta)}</span>`
        : `<span style="${pctColor}">${delta>=0?'+':''}${fmtN(delta)}</span>`;
      cmpHTML += `<tr>
        <td><strong>${r}</strong></td>
        <td class="num">${metrica==='v'?fmt(act):fmtN(act)}</td>
        <td class="num" style="color:var(--text-muted)">${metrica==='v'?fmt(ant):fmtN(ant)}</td>
        <td class="num">${deltaStr}</td>
        <td class="num">${pctStr}</td>
        <td class="num">${part.toFixed(1)}%</td>
      </tr>`;
    });

  const grandPctColor = grandDelta>=0?'color:#059669':'color:#F43F5E';
  const grandPctStr = grandPct!==null
    ? `<span style="${grandPctColor};font-weight:700">${grandDelta>=0?'+':''}${grandPct.toFixed(1)}%</span>`
    : `<span style="color:var(--text-muted)">N/A</span>`;
  cmpHTML += `<tr style="background:#EFF6FF;font-weight:700">
    <td>TOTAL</td>
    <td class="num">${metrica==='v'?fmt(grandAct):fmtN(grandAct)}</td>
    <td class="num" style="color:var(--text-muted)">${metrica==='v'?fmt(grandAntT):fmtN(grandAntT)}</td>
    <td class="num"><span style="${grandPctColor}">${grandDelta>=0?'+':''}${metrica==='v'?fmt(grandDelta):fmtN(grandDelta)}</span></td>
    <td class="num">${grandPctStr}</td>
    <td class="num">100%</td>
  </tr>`;
  cmpHTML += '</tbody></table>';
  document.getElementById('comparativa-container').innerHTML = cmpHTML;

  // INCIDENCIA x MES: filas = meses, columnas = locales, valor = $ + % por rubro
  const allLocales = [...new Set(DET.filter(d=>d.a===anoErp).map(d=>d.l))].sort();
  const rubrosInc = rubroErp
    ? [rubroErp]
    : [...new Set(DET.filter(d=>d.a===anoErp).map(d=>d.r))].sort();

  // pivot [mes][local][rubro] = valor
  const incPivot = {};
  for (let m=1;m<=12;m++) {
    incPivot[m] = {};
    allLocales.forEach(l => {
      incPivot[m][l] = {};
      rubrosInc.forEach(r => { incPivot[m][l][r] = 0; });
    });
  }
  DET.filter(d => d.a===anoErp && rubrosInc.includes(d.r)).forEach(d => {
    if (incPivot[d.m] && incPivot[d.m][d.l] && incPivot[d.m][d.l][d.r]!==undefined)
      incPivot[d.m][d.l][d.r] += metrica==='v' ? d.v : d.u;
  });

  // Aggregate per [mes][local] summing rubros
  const incAgg = {};
  for (let m=1;m<=12;m++) {
    incAgg[m] = {};
    allLocales.forEach(l => {
      incAgg[m][l] = rubrosInc.reduce((s,r) => s + (incPivot[m][l][r]||0), 0);
    });
  }

  // Build header
  let incHTML = `<table class="data-table"><thead>`;

  // If showing all rubros, add a rubro sub-header row
  if (!rubroErp && rubrosInc.length > 1) {
    incHTML += `<tr><th rowspan="2">Mes</th>`;
    allLocales.forEach(l => {
      incHTML += `<th class="num" colspan="2" style="text-align:center;border-left:2px solid #CBD5E1">${l}</th>`;
    });
    incHTML += `<th class="num" colspan="2" style="text-align:center;border-left:2px solid #CBD5E1">TOTAL MES</th></tr>`;
    incHTML += `<tr>`;
    allLocales.forEach(() => {
      incHTML += `<th class="num" style="border-left:2px solid #CBD5E1">${metrica==='v'?'$':'Uds'}</th><th class="num">%</th>`;
    });
    incHTML += `<th class="num" style="border-left:2px solid #CBD5E1">${metrica==='v'?'$':'Uds'}</th><th class="num">%</th></tr>`;
  } else {
    incHTML += `<tr><th>Mes</th>`;
    allLocales.forEach(l => {
      incHTML += `<th class="num" style="border-left:2px solid #CBD5E1">${l} ${metrica==='v'?'$':'Uds'}</th><th class="num">${l} %</th>`;
    });
    incHTML += `<th class="num" style="border-left:2px solid #CBD5E1">Total</th></tr>`;
  }
  incHTML += `</thead><tbody>`;

  const MESES_N = {1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre'};
  const colTotals = {};
  allLocales.forEach(l => { colTotals[l] = 0; });
  let grandTotalInc = 0;

  for (let m=1;m<=12;m++) {
    const rowTotal = allLocales.reduce((s,l) => s + (incAgg[m][l]||0), 0);
    if (rowTotal === 0) continue;
    allLocales.forEach(l => { colTotals[l] += incAgg[m][l]||0; });
    grandTotalInc += rowTotal;

    incHTML += `<tr><td><strong>${MESES_N[m]}</strong></td>`;
    allLocales.forEach(l => {
      const v = incAgg[m][l] || 0;
      const pct = rowTotal > 0 ? (v / rowTotal * 100) : 0;
      const pctColor = pct >= 30 ? '#1d4ed8' : pct >= 15 ? '#0369a1' : 'var(--text-muted)';
      incHTML += `<td class="num" style="border-left:2px solid #F1F5F9">${metrica==='v'?fmt(v):fmtN(v)}</td>`;
      incHTML += `<td class="num"><span style="color:${pctColor};font-weight:${pct>=20?'700':'400'}">${pct.toFixed(1)}%</span></td>`;
    });
    incHTML += `<td class="num" style="font-weight:700;border-left:2px solid #CBD5E1">${metrica==='v'?fmt(rowTotal):fmtN(rowTotal)}</td>`;
    if (!rubroErp && rubrosInc.length > 1) incHTML += `<td class="num">100%</td>`;
    incHTML += `</tr>`;
  }

  // Totales finales
  incHTML += `<tr style="background:#EFF6FF;font-weight:700"><td>TOTAL AÑO</td>`;
  allLocales.forEach(l => {
    const v2 = colTotals[l];
    const pct2 = grandTotalInc > 0 ? (v2 / grandTotalInc * 100) : 0;
    incHTML += `<td class="num" style="border-left:2px solid #CBD5E1">${metrica==='v'?fmt(v2):fmtN(v2)}</td>`;
    incHTML += `<td class="num">${pct2.toFixed(1)}%</td>`;
  });
  incHTML += `<td class="num" style="border-left:2px solid #CBD5E1">${metrica==='v'?fmt(grandTotalInc):fmtN(grandTotalInc)}</td>`;
  if (!rubroErp && rubrosInc.length > 1) incHTML += `<td class="num">100%</td>`;
  incHTML += `</tr></tbody></table>`;
  document.getElementById('incidencia-container').innerHTML = incHTML;
}

// =====================================================
// TAB SWITCHER
// =====================================================
function toggleSec(id, el) {
  const sec = document.getElementById(id);
  if (!sec) return;
  const hidden = sec.style.display === 'none';
  sec.style.display = hidden ? '' : 'none';
  el.classList.toggle('active', hidden);
}

function switchTab(group, name, el) {
  document.querySelectorAll('[id^="panel-' + group + '-"]').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + group + '-' + name);
  if (target) target.classList.add('active');
  if (el) {
    const tabsEl = el.closest('.tabs');
    if (tabsEl) tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }
}

// =====================================================
// TABLA DETALLADA
// =====================================================
function renderTables() {
  const anoTbl = parseInt(document.getElementById('tbl-año').value);
  const mesTbl = document.getElementById('tbl-mes').value;
  const mesNum = mesTbl ? parseInt(mesTbl) : null;
  const filtered = DET.filter(d => d.a===anoTbl && (!mesNum || d.m===mesNum));

  // ── POR LOCAL ──
  const localTotals = {};
  filtered.forEach(d => {
    if (!localTotals[d.l]) localTotals[d.l] = {v:0, u:0};
    localTotals[d.l].v += d.v;
    localTotals[d.l].u += d.u;
  });
  const localRows = Object.entries(localTotals).sort((a,b) => b[1].v - a[1].v);
  const totalV = localRows.reduce((s,[,x]) => s+x.v, 0);
  const totalU = localRows.reduce((s,[,x]) => s+x.u, 0);

  let localHTML = `<table class="data-table"><thead><tr>
    <th>#</th><th>Local</th>
    <th class="num">Ventas con IVA</th><th class="num">Part. %</th>
    <th class="num">Unidades</th><th class="num">Part. %</th><th class="num">Ticket Prom.</th>
  </tr></thead><tbody>`;
  localRows.forEach(([loc, vals], i) => {
    const partV = totalV>0 ? (vals.v/totalV*100) : 0;
    const partU = totalU>0 ? (vals.u/totalU*100) : 0;
    const ticket = vals.u>0 ? (vals.v/vals.u) : 0;
    localHTML += `<tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td><strong>${loc}</strong></td>
      <td class="num">${fmt(vals.v)}</td>
      <td class="num"><span style="background:#DBEAFE;color:#1E40AF;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${partV.toFixed(1)}%</span></td>
      <td class="num">${fmtN(vals.u)}</td>
      <td class="num"><span style="background:#D1FAE5;color:#065F46;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${partU.toFixed(1)}%</span></td>
      <td class="num">${fmt(ticket)}</td>
    </tr>`;
  });
  localHTML += `<tr style="background:#EFF6FF;font-weight:700">
    <td colspan="2">TOTAL</td>
    <td class="num">${fmt(totalV)}</td><td class="num">100%</td>
    <td class="num">${fmtN(totalU)}</td><td class="num">100%</td>
    <td class="num">${totalU>0?fmt(totalV/totalU):'—'}</td>
  </tr></tbody></table>`;
  document.getElementById('tbl-local-content').innerHTML = localHTML;

  // ── POR RUBRO ──
  const rubroTotals = {};
  filtered.forEach(d => {
    if (!rubroTotals[d.r]) rubroTotals[d.r] = {v:0, u:0};
    rubroTotals[d.r].v += d.v;
    rubroTotals[d.r].u += d.u;
  });
  const rubroRows = Object.entries(rubroTotals).sort((a,b) => b[1].v - a[1].v);
  const totRV = rubroRows.reduce((s,[,x]) => s+x.v, 0);
  const totRU = rubroRows.reduce((s,[,x]) => s+x.u, 0);

  let rubroHTML = `<table class="data-table"><thead><tr>
    <th>#</th><th>Rubro</th>
    <th class="num">Ventas con IVA</th><th class="num">Part. %</th>
    <th class="num">Unidades</th><th class="num">Part. %</th><th class="num">Ticket Prom.</th>
  </tr></thead><tbody>`;
  rubroRows.forEach(([rub, vals], i) => {
    const partV = totRV>0 ? (vals.v/totRV*100) : 0;
    const partU = totRU>0 ? (vals.u/totRU*100) : 0;
    const ticket = vals.u>0 ? (vals.v/vals.u) : 0;
    rubroHTML += `<tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td><strong>${rub}</strong></td>
      <td class="num">${fmt(vals.v)}</td>
      <td class="num"><span style="background:#DBEAFE;color:#1E40AF;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${partV.toFixed(1)}%</span></td>
      <td class="num">${fmtN(vals.u)}</td>
      <td class="num"><span style="background:#D1FAE5;color:#065F46;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${partU.toFixed(1)}%</span></td>
      <td class="num">${fmt(ticket)}</td>
    </tr>`;
  });
  rubroHTML += `<tr style="background:#EFF6FF;font-weight:700">
    <td colspan="2">TOTAL</td>
    <td class="num">${fmt(totRV)}</td><td class="num">100%</td>
    <td class="num">${fmtN(totRU)}</td><td class="num">100%</td>
    <td class="num">${totRU>0?fmt(totRV/totRU):'—'}</td>
  </tr></tbody></table>`;
  document.getElementById('tbl-rubro-content').innerHTML = rubroHTML;

  // ── YOY COMPARACION ──
  const anoAnt = anoTbl - 1;
  const filteredAnt = DET.filter(d => d.a===anoAnt && (!mesNum || d.m===mesNum));
  const allRubrosYoy = [...new Set([...filtered.map(d=>d.r), ...filteredAnt.map(d=>d.r)])].sort();

  const yoyAct = {}, yoyAnt = {};
  allRubrosYoy.forEach(r => { yoyAct[r]={v:0,u:0}; yoyAnt[r]={v:0,u:0}; });
  filtered.forEach(d => { if(yoyAct[d.r]){ yoyAct[d.r].v+=d.v; yoyAct[d.r].u+=d.u; } });
  filteredAnt.forEach(d => { if(yoyAnt[d.r]){ yoyAnt[d.r].v+=d.v; yoyAnt[d.r].u+=d.u; } });

  let yoyHTML = `<table class="data-table"><thead><tr>
    <th>Rubro</th>
    <th class="num">Ventas ${anoTbl}</th><th class="num">Ventas ${anoAnt}</th>
    <th class="num">Var. $</th><th class="num">Var. %</th>
    <th class="num">Uds. ${anoTbl}</th><th class="num">Uds. ${anoAnt}</th>
    <th class="num">Var. Uds %</th>
  </tr></thead><tbody>`;
  allRubrosYoy
    .map(r => ({ r, act: yoyAct[r], ant: yoyAnt[r] }))
    .sort((a,b) => b.act.v - a.act.v)
    .forEach(({r, act, ant}) => {
      const dv = ant.v>0 ? ((act.v-ant.v)/ant.v*100) : null;
      const du = ant.u>0 ? ((act.u-ant.u)/ant.u*100) : null;
      const dvStr = dv!==null ? `<span style="color:${dv>=0?'#059669':'#F43F5E'};font-weight:600">${dv>=0?'+':''}${dv.toFixed(1)}%</span>` : '—';
      const duStr = du!==null ? `<span style="color:${du>=0?'#059669':'#F43F5E'};font-weight:600">${du>=0?'+':''}${du.toFixed(1)}%</span>` : '—';
      const deltaV = act.v - ant.v;
      const deltaVStr = `<span style="color:${deltaV>=0?'#059669':'#F43F5E'}">${deltaV>=0?'+':''}${fmt(deltaV)}</span>`;
      yoyHTML += `<tr>
        <td><strong>${r}</strong></td>
        <td class="num">${fmt(act.v)}</td>
        <td class="num" style="color:var(--text-muted)">${fmt(ant.v)}</td>
        <td class="num">${deltaVStr}</td>
        <td class="num">${dvStr}</td>
        <td class="num">${fmtN(act.u)}</td>
        <td class="num" style="color:var(--text-muted)">${fmtN(ant.u)}</td>
        <td class="num">${duStr}</td>
      </tr>`;
    });
  yoyHTML += '</tbody></table>';
  document.getElementById('tbl-yoy-content').innerHTML = yoyHTML;
}

// =====================================================
// PROYECCION 12 MESES
// =====================================================
let chartProjVentas = null, chartProjUds = null;

function renderProjection() {
  const labels = PROJ.map(p => MESES_CORTO[p.m] + "'" + String(p.a).slice(2));
  const ventas = PROJ.map(p => p.v);
  const prevVentas = PROJ.map(p => p.prev_v);

  if (chartProjVentas) chartProjVentas.destroy();
  chartProjVentas = new Chart(document.getElementById('chart-proj-ventas').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Proyeccion', data: ventas, backgroundColor: colorAlpha('#6366F1', 0.75), borderColor: '#6366F1', borderWidth: 1 },
        { label: 'Mismo mes año ant.', data: prevVentas, backgroundColor: colorAlpha('#F59E0B', 0.5), borderColor: '#F59E0B', borderWidth: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmt(v) } }
      }
    }
  });

  // Unidades: estimate from last known avg ticket per unit
  const lastKnownYear = Math.max(...DET.map(d=>d.a));
  const lastYearDET = DET.filter(d => d.a===lastKnownYear);
  const totalV_lk = lastYearDET.reduce((s,d)=>s+d.v,0);
  const totalU_lk = lastYearDET.reduce((s,d)=>s+d.u,0);
  const avgTicket = totalU_lk > 0 ? totalV_lk / totalU_lk : 1;
  const udsProj = PROJ.map(p => Math.round(p.v / avgTicket));

  if (chartProjUds) chartProjUds.destroy();
  chartProjUds = new Chart(document.getElementById('chart-proj-uds').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Unidades estimadas', data: udsProj, borderColor: '#10B981', backgroundColor: colorAlpha('#10B981', 0.1), fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 }]
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => fmtN(ctx.raw) + ' uds' } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtN(v) } }
      }
    }
  });

  // Tabla proyeccion
  let projHTML = `<table class="data-table"><thead><tr>
    <th>Mes</th><th class="num">Proyeccion Ventas</th><th class="num">Inflacion Mensual</th>
    <th class="num">Estacionalidad</th><th class="num">Mismo Mes Año Ant</th><th class="num">Var. %</th>
    <th class="num">Uds. Est.</th>
  </tr></thead><tbody>`;
  PROJ.forEach((p, i) => {
    const dv = p.prev_v > 0 ? ((p.v - p.prev_v)/p.prev_v*100) : null;
    const dvStr = dv!==null ? `<span style="color:${dv>=0?'#059669':'#F43F5E'};font-weight:600">${dv>=0?'+':''}${dv.toFixed(1)}%</span>` : '—';
    const rowClass = i % 2 === 0 ? '' : '';
    projHTML += `<tr class="${rowClass}">
      <td><strong>${MESES[p.m]} ${p.a}</strong></td>
      <td class="num">${fmt(p.v)}</td>
      <td class="num">${p.inf.toFixed(1)}%</td>
      <td class="num">${(p.season * 100).toFixed(1)}%</td>
      <td class="num" style="color:var(--text-muted)">${fmt(p.prev_v)}</td>
      <td class="num">${dvStr}</td>
      <td class="num">${fmtN(udsProj[i])}</td>
    </tr>`;
  });
  const totalProj = PROJ.reduce((s,p)=>s+p.v,0);
  const totalPrev = PROJ.reduce((s,p)=>s+p.prev_v,0);
  const totalUds = udsProj.reduce((s,v)=>s+v,0);
  const dtotal = totalPrev>0?((totalProj-totalPrev)/totalPrev*100):null;
  const dtotalStr = dtotal!==null?`<span style="color:${dtotal>=0?'#059669':'#F43F5E'};font-weight:600">${dtotal>=0?'+':''}${dtotal.toFixed(1)}%</span>`:'—';
  projHTML += `<tr style="background:#EFF6FF;font-weight:700">
    <td>TOTAL</td><td class="num">${fmt(totalProj)}</td>
    <td class="num">—</td><td class="num">—</td>
    <td class="num">${fmt(totalPrev)}</td><td class="num">${dtotalStr}</td>
    <td class="num">${fmtN(totalUds)}</td>
  </tr></tbody></table>`;
  document.getElementById('proj-table-container').innerHTML = projHTML;
}

// =====================================================
// STARTUP
// =====================================================
document.addEventListener('DOMContentLoaded', async function() {
  // Cargar datos desde la API
  try {
    document.getElementById('loading').style.display = 'flex';
    const [rawRes, detRes] = await Promise.all([
      fetch('api/ventas_mensuales.php'),
      fetch('api/detalle.php')
    ]);
    const rawJson = await rawRes.json();
    const detJson = await detRes.json();

    if (!rawJson.ok || !detJson.ok) throw new Error('Error en la API');

    // Convertir formato API → formato esperado por el dashboard
    RAW = rawJson.data.map(r => ({
      año: r.año,
      mes: r.mes,
      total: r.total,
      locales: typeof r.locales === 'string' ? JSON.parse(r.locales) : r.locales
    }));
    DET = detJson.data;

  } catch(e) {
    console.error('Error cargando datos:', e);
    document.getElementById('loading').innerHTML =
      '<div style="color:#F43F5E;font-size:16px">Error al cargar datos desde la API.<br><small>' + e.message + '</small></div>';
    return;
  }

  // Fase 1: init y KPIs (inmediato — sin charts)
  try { initBanner(); } catch(e) { console.error('initBanner:', e); }
  try { initControls(); } catch(e) { console.error('initControls:', e); }
  try { renderKPIs(); } catch(e) { console.error('renderKPIs:', e); }

  // Fase 2: charts principales (diferido para no bloquear el render inicial)
  setTimeout(function() {
    try { renderEvoChart(); } catch(e) { console.error('renderEvoChart:', e); }
    try { renderEvoTable(); } catch(e) { console.error('renderEvoTable:', e); }
    try { renderLocalChart(); } catch(e) { console.error('renderLocalChart:', e); }
    try { renderRubroChart(); } catch(e) { console.error('renderRubroChart:', e); }
  }, 0);

  // Fase 3: secciones pesadas (diferido extra) + ocultar overlay
  setTimeout(function() {
    try { renderUdsCharts(); } catch(e) { console.error('renderUdsCharts:', e); }
    try { renderErpCharts(); } catch(e) { console.error('renderErpCharts:', e); }
    try { renderTables(); } catch(e) { console.error('renderTables:', e); }
    try { renderProjection(); } catch(e) { console.error('renderProjection:', e); }
    var overlay = document.getElementById('loading');
    if (overlay) overlay.style.display = 'none';
  }, 50);
});

// =====================================================
// EXPORTAR TABLA ACTIVA A EXCEL
// =====================================================
function exportarTablaExcel() {
  // Detectar qué panel está activo en sec-tabla
  const panels = ['panel-tbl-local', 'panel-tbl-rubro', 'panel-tbl-yoy'];
  let activeId = panels[0];
  for (const id of panels) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('active')) { activeId = id; break; }
  }

  const container = document.getElementById(activeId);
  const table = container ? container.querySelector('table') : null;
  if (!table) { alert('No hay datos para exportar.'); return; }

  // Construir array de arrays para SheetJS
  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const row = [];
    tr.querySelectorAll('th, td').forEach(cell => {
      // Limpiar texto: quitar spans internos, badges, etc.
      row.push(cell.innerText.trim());
    });
    rows.push(row);
  });

  const año = document.getElementById('tbl-año').value;
  const mesEl = document.getElementById('tbl-mes');
  const mes = mesEl.options[mesEl.selectedIndex].text;
  const tab = activeId.replace('panel-tbl-', '');
  const nombreArchivo = `ventas_${tab}_${año}_${mes === 'Todo el año' ? 'anual' : mes}.xlsx`;

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ancho de columnas automático
  const colWidths = rows[0] ? rows[0].map((_, ci) => ({
    wch: Math.max(...rows.map(r => (r[ci] || '').toString().length), 8)
  })) : [];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  XLSX.writeFile(wb, nombreArchivo);
}

