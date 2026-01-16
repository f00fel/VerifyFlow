const API_BASE = "http://80.87.103.127:8000";

const fileEl = document.getElementById('file');
const runEl = document.getElementById('run');
const clearEl = document.getElementById('clear');
const metaEl = document.getElementById('meta');
const profileEl = document.getElementById('profile');
const reportArea = document.getElementById('reportArea');

let chosen = null;
let lastReport = null;
let currentFilter = "all";

function esc(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function sevLabel(sev){
  if (sev === "critical") return "Критично";
  if (sev === "warning") return "Предупреждение";
  if (sev === "info") return "Информация";
  return "ОК";
}

function dotClass(sev){
  return (sev === "critical" || sev === "warning" || sev === "info") ? sev : "ok";
}

function renderEmpty(text){
  reportArea.innerHTML = `<div class="empty">${esc(text)}</div>`;
}

function renderLoading(){
  reportArea.innerHTML = `
    <div class="empty">
      Проверяем документ...<br/>
      <span class="muted small">Для больших файлов потребуется несколько секунд.</span>
    </div>
  `;
}

function renderReport(report){
  lastReport = report;

  const s = report.summary || {critical:0, warning:0, info:0, total:0};
  const detected = report.detected || {};
  const margins = detected.margins_mm || {};
  const most = (detected.most_common || {});
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const na = "нет";

  const total = (s.total ?? issues.length ?? 0);

  const kpisHtml = `
    <div class="kpis">
      <div class="kpi"><b><span class="dot ${total===0 ? 'ok':'critical'}"></span>${total}</b><span>Нарушений</span></div>
      <div class="kpi"><b><span class="dot critical"></span>${s.critical ?? 0}</b><span>Критичных</span></div>
      <div class="kpi"><b><span class="dot warning"></span>${s.warning ?? 0}</b><span>Предупреждений</span></div>
      <div class="kpi"><b><span class="dot info"></span>${s.info ?? 0}</b><span>Инфо</span></div>
    </div>
  `;

  const filtersHtml = `
    <div class="filters">
      <div class="chip ${currentFilter==='all'?'active':''}" data-filter="all">Все</div>
      <div class="chip ${currentFilter==='critical'?'active':''}" data-filter="critical">Критичные</div>
      <div class="chip ${currentFilter==='warning'?'active':''}" data-filter="warning">Предупреждения</div>
      <div class="chip ${currentFilter==='info'?'active':''}" data-filter="info">Инфо</div>
    </div>
  `;

  const leftHtml = `
    <div class="card subcard">
      <div class="section-title">Сводка</div>
      <div class="pill">Профиль: <b style="color:var(--text)">${esc(report.profile || na)}</b></div>
      ${kpisHtml}
      ${filtersHtml}
    </div>
  `;

  const rightHtml = `
    <div class="card subcard">
      <div class="section-title">Параметры документа</div>
      <div class="muted small">
        <div><b>Поля (мм):</b> слева ${margins.left ?? na}, справа ${margins.right ?? na}, сверху ${margins.top ?? na}, снизу ${margins.bottom ?? na}</div>
        <div><b>Шрифт:</b> ${esc(most.font_name || na)}, размер ${esc(most.font_size || na)}, межстрочный ${esc(most.line_spacing || na)}</div>
      </div>
    </div>
  `;

  const filtered = issues.filter(it => {
    if (currentFilter === "all") return true;
    return (it.severity || "").toLowerCase() === currentFilter;
  });

  let issuesHtml = "";
  if (issues.length === 0) {
    issuesHtml = `<div class="empty">Нарушений не найдено.</div>`;
  } else if (filtered.length === 0) {
    const labelMap = {critical:"Критичные", warning:"Предупреждения", info:"Инфо"};
    const label = labelMap[currentFilter] || "Все";
    issuesHtml = `<div class="empty">Нет нарушений для фильтра "${label}".</div>`;
  } else {
    issuesHtml = filtered.map((it, index) => {
      const sev = (it.severity || "info").toLowerCase();
      const rule = it.rule ? `<div class="rule">${esc(it.rule)}</div>` : "";
      const how = it.how_to_fix ? `<div class="how">${esc(it.how_to_fix)}</div>` : "";
      return `
        <div class="issue" style="animation-delay:${index * 60}ms">
          <div class="issue-head">
            <div class="sev ${dotClass(sev)}"><span class="dot ${dotClass(sev)}"></span>${sevLabel(sev)}</div>
            ${rule}
          </div>
          <div><b>${esc(it.message || "Нарушение")}</b></div>
          ${how}
        </div>
      `;
    }).join("");
  }

  reportArea.innerHTML = `
    <div class="two">
      ${leftHtml}
      ${rightHtml}
    </div>

    <div class="issues grid">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <h2>Нарушения</h2>
        <div class="muted small">Показано: ${filtered.length} из ${issues.length}</div>
      </div>
      ${issuesHtml}
    </div>

    <details class="small">
      <summary>Данные ответа (JSON)</summary>
      <pre>${esc(JSON.stringify(report, null, 2))}</pre>
    </details>
  `;

  document.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => {
      currentFilter = el.getAttribute('data-filter');
      renderReport(lastReport);
    });
  });
}

function resetUI(){
  chosen = null;
  lastReport = null;
  currentFilter = "all";
  runEl.disabled = true;
  clearEl.disabled = true;
  metaEl.textContent = "Файл не выбран.";
  fileEl.value = "";
  renderEmpty("Загрузите документ и нажмите \"Проверить\".");
}

fileEl.addEventListener('change', () => {
  const f = fileEl.files && fileEl.files[0];
  if (!f) return;

  const ext = f.name.toLowerCase();
  if (!ext.endsWith('.docx') && !ext.endsWith('.pdf')) {
    metaEl.textContent = "Выберите файл .docx или .pdf.";
    renderEmpty("Неверный формат. Поддерживаются .docx и .pdf.");
    runEl.disabled = true;
    clearEl.disabled = false;
    chosen = null;
    return;
  }

  chosen = f;
  runEl.disabled = false;
  clearEl.disabled = false;
  metaEl.textContent = `Выбран файл: ${f.name} (${Math.round(f.size/1024)} KB)`;
  renderEmpty("Файл готов к проверке. Нажмите \"Проверить\".");
});

clearEl.addEventListener('click', resetUI);

runEl.addEventListener('click', async () => {
  if (!chosen) return;

  runEl.disabled = true;
  clearEl.disabled = true;
  renderLoading();

  try {
    const fd = new FormData();
    fd.append("file", chosen);

    const profile = profileEl.value;
    const res = await fetch(`${API_BASE}/api/check?profile=${encodeURIComponent(profile)}`, {
      method: "POST",
      body: fd
    });

    const text = await res.text();
    if (!res.ok) {
      renderEmpty(`Ошибка ${res.status}: ${text}`);
      return;
    }

    const report = JSON.parse(text);
    renderReport(report);
  } catch (e) {
    renderEmpty(`Ошибка соединения: ${e}`);
  } finally {
    runEl.disabled = false;
    clearEl.disabled = false;
  }
});

resetUI();