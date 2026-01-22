//python main.pyconst API_BASE = "/api";
const API_BASE = "/api";
//const API_BASE = "http://localhost:5000/api";
const fileEl = document.getElementById('file');
const runEl = document.getElementById('run');
const clearEl = document.getElementById('clear');
const metaEl = document.getElementById('meta');
const profileEl = document.getElementById('profile');
const reportArea = document.getElementById('reportArea');

let chosen = null;
let lastReport = null;

// ==================== ЧАСТЬ 1: КОММЕНТАРИИ И СКАЧИВАНИЕ ====================

let comments = []; // Массив для хранения комментариев
const commentSection = document.createElement('div'); // Создадим элемент динамически

// Функция для отображения комментариев
function renderComments() {
  const commentsList = document.getElementById('commentsList');
  if (!commentsList) return;
  
  if (comments.length === 0) {
    commentsList.innerHTML = '<div class="empty" style="border: none; background: transparent;">Комментариев пока нет</div>';
    return;
  }
  
  commentsList.innerHTML = comments.map((comment, index) => `
    <div class="comment-item">
      <div class="comment-header">
        <span>Комментарий #${index + 1}</span>
        <span class="comment-timestamp">${comment.timestamp}</span>
      </div>
      <div class="comment-text">${esc(comment.text)}</div>
    </div>
  `).join('');
}

// Функция для добавления нового комментария
function addComment() {
  const textarea = document.getElementById('newComment');
  const text = textarea.value.trim();
  
  if (!text) {
    alert('Введите текст комментария');
    return;
  }
  
  const newComment = {
    text: text,
    timestamp: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
  
  comments.push(newComment);
  textarea.value = '';
  renderComments();
}

// Функция для скачивания отчёта с комментариями
function downloadReportWithComments() {
  if (!lastReport) {
    alert('Сначала выполните проверку документа');
    return;
  }
  
  let reportContent = `ОТЧЁТ ПРОВЕРКИ ДОКУМЕНТА\n`;
  reportContent += `Дата проверки: ${new Date().toLocaleString('ru-RU')}\n`;
  reportContent += `Профиль проверки: ${lastReport.profile || 'не указан'}\n`;
  reportContent += `Файл: ${chosen ? chosen.name : 'не указан'}\n`;
  
  // Если есть номер приказа
  const orderNumberInput = document.getElementById('orderNumber');
  const orderNumber = orderNumberInput ? orderNumberInput.value : '';
  if (orderNumber.trim()) {
    reportContent += `Номер приказа: ${orderNumber.trim()}\n`;
  }
  
  reportContent += `\n${'='.repeat(60)}\n\n`;
  
  // Сводка
  const s = lastReport.summary || {critical:0, warning:0, info:0, total:0};
  reportContent += `СВОДКА:\n`;
  reportContent += `Всего нарушений: ${s.total || 0}\n`;
  reportContent += `Критичных: ${s.critical || 0}\n`;
  reportContent += `Предупреждений: ${s.warning || 0}\n`;
  reportContent += `Информационных: ${s.info || 0}\n\n`;
  
  // НОВОЕ: Добавляем сводку по местоположениям
  reportContent += `РАСПРЕДЕЛЕНИЕ ОШИБОК ПО ДОКУМЕНТУ:\n`;
  reportContent += `${'─'.repeat(40)}\n`;
  
  const locationCounts = {};
  const issues = Array.isArray(lastReport.issues) ? lastReport.issues : [];
  
  issues.forEach(issue => {
    if (!issue.location) return;
    
    let locationName = issue.location;
    if (issue.message && (issue.message.includes("ФИО") || issue.message.includes("фио"))) {
      locationName = "Ошибки ФИО";
    }
    else if (locationName === "title_page") locationName = "Титульная страница";
    else if (locationName.includes("page:")) {
      const pageNum = locationName.split(":")[1];
      locationName = `Страница ${pageNum}`;
    }
    else if (locationName === "calendar_plan_table") locationName = "Таблица календарного плана";
    else if (locationName === "document") locationName = "Основной текст";
    
    locationCounts[locationName] = (locationCounts[locationName] || 0) + 1;
  });
  
  if (Object.keys(locationCounts).length > 0) {
    Object.entries(locationCounts).forEach(([loc, count]) => {
      reportContent += `• ${loc}: ${count} ошибок\n`;
    });
  } else {
    reportContent += `Ошибки распределены по всему документу\n`;
  }
  
  reportContent += `\n${'='.repeat(60)}\n\n`;
  
  // Нарушения с ПОДРОБНЫМИ подсказками
  if (issues.length > 0) {
    reportContent += `ПОДРОБНЫЙ СПИСОК НАРУШЕНИЙ:\n`;
    reportContent += `${'─'.repeat(40)}\n\n`;
    
    issues.forEach((issue, i) => {
      const sev = issue.severity || 'info';
      
      reportContent += `${i+1}. [${sevLabel(sev).toUpperCase()}] ${issue.message || 'Нарушение'}\n`;
      
      // ДЕТАЛЬНЫЕ ИНСТРУКЦИИ ДЛЯ ПОЛЬЗОВАТЕЛЯ
      let detailedHint = "";
      
      // Для ФИО ошибок - те же умные подсказки
      if (issue.message && (
          issue.message.includes("ФИО") || 
          issue.message.includes("фио") || 
          issue.message.includes("Фамилия") ||
          issue.message.includes("студент") ||
          issue.message.includes("руководитель") ||
          issue.message.includes("падеж") ||
          issue.message.includes("сокращени")
        )) {
        
        const message = issue.message.toLowerCase();
        
        if (message.includes("не найдено")) {
          if (message.includes("обучающегося") || message.includes("студент")) {
            detailedHint = "ГДЕ ИСКАТЬ: Ищите ФИО студента после слов 'обучающегося', 'допустить', 'студента' на титульной странице\n";
          }
          if (message.includes("руководителя") || message.includes("руководитель")) {
            detailedHint = "ГДЕ ИСКАТЬ: Ищите ФИО руководителя после слов 'руководитель', 'научный руководитель' на титульной странице\n";
          }
        }
        
        if (message.includes("сокращения") || message.includes("и.о.") || message.includes("и. о.")) {
          detailedHint = "ГДЕ ИСКАТЬ: Найдите все сокращения вида 'И.И. Иванов' в документе\n";
          detailedHint += "ПРАВИЛЬНЫЙ ФОРМАТ: 'Иван Иванович Иванов' (полное имя без точек)\n";
          detailedHint += "ПРИМЕР: ❌ И.И. Иванов → ✅ Иван Иванович Иванов\n";
        }
        
        if (message.includes("падеж") || message.includes("падеже")) {
          detailedHint = "ГДЕ ИСКАТЬ: Проверьте падеж ФИО после предлогов в документе\n";
          detailedHint += "ПРАВИЛО: 'от студента' требует родительный падеж\n";
          detailedHint += "ПРИМЕР: ❌ от студент Иванов Иван → ✅ от студента Иванова Ивана\n";
        }
        
        if (!detailedHint && (message.includes("фио") || message.includes("фамилия"))) {
          detailedHint = "ГДЕ ИСКАТЬ: Проверьте все упоминания ФИО на титульной странице\n";
        }
      } 
      // Для других ошибок - стандартное местоположение
      else if (issue.location) {
        if (issue.location === "title_page") {
          detailedHint = "МЕСТОПОЛОЖЕНИЕ: Титульная страница (первая страница документа)\n";
        }
        else if (issue.location === "calendar_plan_table") {
          detailedHint = "МЕСТОПОЛОЖЕНИЕ: Таблица календарного плана\n";
        }
        else if (issue.location.includes("page:")) {
          const pageNum = issue.location.split(":")[1];
          detailedHint = `МЕСТОПОЛОЖЕНИЕ: Страница ${pageNum}\n`;
        }
        else if (issue.location === "document") {
          detailedHint = "МЕСТОПОЛОЖЕНИЕ: Основной текст документа\n";
        }
      }
      
      // Контекст ошибки если есть
      if (issue.evidence && issue.evidence !== "—" && issue.evidence !== "-") {
        detailedHint += `КОНТЕКСТ: ${issue.evidence}\n`;
      }
      
      // Как исправить
      if (issue.how_to_fix) {
        detailedHint += `КАК ИСПРАВИТЬ: ${issue.how_to_fix}\n`;
      }
      
      // Добавляем rule если есть
      if (issue.rule) {
        detailedHint += `ПРАВИЛО: ${issue.rule}\n`;
      }
      
      if (detailedHint) {
        reportContent += "   " + detailedHint.replace(/\n/g, "\n   ");
      }
      
      reportContent += `\n`;
    });
  }
  
  // Комментарии
  if (comments.length > 0) {
    reportContent += `\n${'='.repeat(60)}\n\n`;
    reportContent += `КОММЕНТАРИИ К ПРОВЕРКЕ:\n`;
    reportContent += `${'─'.repeat(40)}\n\n`;
    
    comments.forEach((comment, i) => {
      reportContent += `КОММЕНТАРИЙ #${i+1} (${comment.timestamp}):\n`;
      reportContent += `${comment.text}\n\n`;
    });
  }
  
  // ЧЕК-ЛИСТ для пользователя
  reportContent += `\n${'='.repeat(60)}\n\n`;
  reportContent += `ЧЕК-ЛИСТ ДЛЯ ИСПРАВЛЕНИЯ:\n`;
  reportContent += `${'─'.repeat(40)}\n\n`;
  
  issues.forEach((issue, i) => {
    reportContent += `[ ] ${i+1}. ${issue.message}\n`;
  });
  
  reportContent += `\n\nИНСТРУКЦИЯ:\n`;
  reportContent += `1. Откройте документ в Microsoft Word или другом редакторе\n`;
  reportContent += `2. Исправьте ошибки согласно списку выше\n`;
  reportContent += `3. Отметьте галочкой исправленные пункты\n`;
  reportContent += `4. Перепроверьте документ через VerifyFlow\n`;
  reportContent += `5. Сохраните исправленную версию\n`;
  
  // Создаём и скачиваем файл
  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  const docName = chosen ? chosen.name.replace(/\.[^/.]+$/, "") : 'документ';
  const fileName = `verifyflow_отчет_${docName}_${timestamp}.txt`;
  
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

function getLocationSummary(issues) {
  const locationCounts = {};
  
  issues.forEach(issue => {
    if (!issue.location) return;
    
    let locationName = issue.location;
    // Группируем ошибки ФИО отдельно
    if (issue.message && (issue.message.includes("ФИО") || issue.message.includes("фио"))) {
      locationName = "Ошибки ФИО";
    }
    else if (locationName === "title_page") {
      locationName = "Титульная страница";
    }
    else if (locationName.includes("page:")) {
      const pageNum = locationName.split(":")[1];
      locationName = `Страница ${pageNum}`;
    }
    else if (locationName === "calendar_plan_table") {
      locationName = "Таблица календарного плана";
    }
    else if (locationName === "document") {
      locationName = "Основной текст";
    }
    
    locationCounts[locationName] = (locationCounts[locationName] || 0) + 1;
  });
  
  if (Object.keys(locationCounts).length === 0) {
    return '<span style="color: var(--ok);">Ошибки распределены по всему документу</span>';
  }
  
  const items = Object.entries(locationCounts)
    .map(([loc, count]) => {
      let icon = "•";
      if (loc.includes("ФИО")) icon = "👤";
      else if (loc.includes("Титульная")) icon = "📋";
      else if (loc.includes("Страница")) icon = "📖";
      else if (loc.includes("Таблица")) icon = "📊";
      
      return `<div style="display: flex; align-items: center; gap: 6px; margin: 4px 0;">
                <span>${icon}</span>
                <span>${loc}: <b style="color: var(--text);">${count}</b></span>
              </div>`;
    })
    .join('');
  
  return items;
}

function getFIOHint(errorMessage, evidence) {
  const message = errorMessage.toLowerCase();
  
  // Анализируем саму ошибку
  if (message.includes("не найдено")) {
    if (message.includes("обучающегося") || message.includes("студент")) {
      return "Ищите ФИО студента после слов 'обучающегося', 'допустить', 'студента' на титульной странице";
    }
    if (message.includes("руководителя") || message.includes("руководитель")) {
      return "Ищите ФИО руководителя после слов 'руководитель', 'научный руководитель' на титульной странице";
    }
  }
  
  if (message.includes("сокращения") || message.includes("и.о.") || message.includes("и. о.")) {
    return "Найдите все сокращения вида 'И.И. Иванов' и замените на полное имя 'Иван Иванович Иванов'";
  }
  
  if (message.includes("падеж") || message.includes("падеже")) {
    return "Проверьте падеж ФИО после предлогов: 'от студента' → родительный падеж";
  }
  
  if (message.includes("фио") || message.includes("фамилия")) {
    // Анализируем evidence если есть
    if (evidence && evidence !== "—" && evidence !== "-") {
      if (evidence.includes("...")) {
        return `Ищите в тексте: "${evidence.substring(0, 60)}..."`;
      }
    }
    return "Проверьте все упоминания ФИО на титульной странице и в документах";
  }
  
  return "Проверьте правильность написания ФИО в документе";
}

function getOrderNumberHint(errorMessage, evidence) {
  const message = errorMessage.toLowerCase();
  
  if (message.includes("не найден номер")) {
    return "Ищите номер приказа/распоряжения в шапке документа, обычно в формате: '№ 33.02-05/334' или 'Приказ №123/2024'";
  }
  
  if (message.includes("нестандартный формат")) {
    return "Проверьте формат номера. Примеры правильных форматов:\n• 33.02-05/334 (код подразделения-номер/порядковый)\n• 123/2024 (номер/год)\n• 456-р (номер-буква указа)";
  }
  
  if (message.includes("недопустимые символы")) {
    return "В номере приказа разрешены только: цифры 0-9, точка ., тире -, слэш /. Удалите другие символы.";
  }
  
  if (message.includes("слишком короткий")) {
    return "Номер приказа должен содержать минимум 3 символа (например, '1/24' — неправильно, '123/2024' — правильно)";
  }
  
  return "Проверьте номер приказа/распоряжения в документе";
}

function renderReport(report) {
  lastReport = report;

  const s = report.summary || { critical: 0, warning: 0, info: 0, total: 0 };
  const detected = report.detected || {};
  const margins = detected.margins_mm || {};
  const most = (detected.most_common || {});
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const na = "нет";

  const total = (s.total ?? issues.length ?? 0);

  const kpisHtml = `
    <div class="kpis">
      <div class="kpi"><b><span class="dot ${total === 0 ? 'ok' : 'critical'}"></span>${total}</b><span>Нарушений</span></div>
      <div class="kpi"><b><span class="dot critical"></span>${s.critical ?? 0}</b><span>Критичных</span></div>
      <div class="kpi"><b><span class="dot warning"></span>${s.warning ?? 0}</b><span>Предупреждений</span></div>
      <div class="kpi"><b><span class="dot info"></span>${s.info ?? 0}</b><span>Инфо</span></div>
    </div>
  `;

  const filtersHtml = `
    <div class="filters">
      <div class="chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Все</div>
      <div class="chip ${currentFilter === 'critical' ? 'active' : ''}" data-filter="critical">Критичные</div>
      <div class="chip ${currentFilter === 'warning' ? 'active' : ''}" data-filter="warning">Предупреждения</div>
      <div class="chip ${currentFilter === 'info' ? 'active' : ''}" data-filter="info">Инфо</div>
    </div>
  `;

  const locationSummaryHtml = `
  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);">
    <div style="font-size: 12px; color: var(--muted); margin-bottom: 6px;">
      <strong>Где искать ошибки:</strong>
    </div>
    <div style="font-size: 11px; line-height: 1.4;">
      ${getLocationSummary(issues)}
    </div>
  </div>
  `;

  const leftHtml = `
    <div class="card subcard">
      <div class="section-title">Сводка</div>
      <div class="pill">Профиль: <b style="color:var(--text)">${esc(report.profile || na)}</b></div>
      ${kpisHtml}
      ${filtersHtml}
      ${locationSummaryHtml}
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
    const labelMap = { critical: "Критичные", warning: "Предупреждения", info: "Инфо" };
    const label = labelMap[currentFilter] || "Все";
    issuesHtml = `<div class="empty">Нет нарушений для фильтра "${label}".</div>`;
  } else {
    issuesHtml = filtered.map((it, index) => {
      const sev = (it.severity || "info").toLowerCase();
      const rule = it.rule ? `<div class="rule">${esc(it.rule)}</div>` : "";
      const how = it.how_to_fix ? `<div class="how">${esc(it.how_to_fix)}</div>` : "";
      
      
      let locationBadge = "";
      let evidenceHint = "";

      if (it.evidence && it.evidence !== "—" && it.evidence !== "-") {
        evidenceHint = `
          <div style="
            margin-top: 6px;
            padding: 8px 10px;
            background: rgba(11, 15, 20, 0.04);
            border-radius: 8px;
            font-size: 11px;
            font-family: ui-monospace, monospace;
            color: var(--muted);
            border-left: 2px solid var(--accent);
            line-height: 1.4;
          ">
            <strong style="color: var(--text);">Контекст ошибки:</strong> ${esc(it.evidence)}
          </div>
        `;
      }

      // Для ошибок ФИО показываем ОСОБЫЕ подсказки
      if (it.message && (
          it.message.includes("ФИО") || 
          it.message.includes("фио") || 
          it.message.includes("Фамилия") ||
          it.message.includes("студент") ||
          it.message.includes("руководитель") ||
          it.message.includes("падеж") ||
          it.message.includes("сокращени")
        )) {
        
        const hint = getFIOHint(it.message, it.evidence);
        
        locationBadge = `
          <div style="
            margin-top: 8px;
            padding: 10px 12px;
            background: rgba(245, 158, 11, 0.08);
            border-radius: 10px;
            font-size: 13px;
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
            line-height: 1.5;
          ">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <span style="font-size: 14px; margin-top: 2px;">👤</span>
              <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 4px; color: var(--warning);">
                  Где искать эту ошибку:
                </strong>
                <span>${hint}</span>
              </div>
            </div>
          </div>
        `;
      } 

      else if (it.message && (
          it.message.includes("номер приказа") ||
          it.message.includes("приказ") ||
          it.message.includes("распоряжение") ||
          (it.rule && it.rule.includes("OrderNumber"))
        )) {
        
        const hint = getOrderNumberHint(it.message, it.evidence);
        
        locationBadge = `
          <div style="
            margin-top: 8px;
            padding: 10px 12px;
            background: rgba(37, 99, 235, 0.08);
            border-radius: 10px;
            font-size: 13px;
            color: var(--info);
            border: 1px solid rgba(37, 99, 235, 0.3);
            line-height: 1.5;
          ">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <span style="font-size: 14px; margin-top: 2px;">📄</span>
              <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 4px; color: var(--info);">
                  Где искать номер приказа:
                </strong>
                <span>${hint.replace(/\n/g, '<br>')}</span>
              </div>
            </div>
          </div>
        `;
      }

      // Для НЕ-ФИО ошибок показываем обычное местоположение
      else if (it.location) {
        let locationText = "";
        let icon = "📍";
        
        if (it.location === "title_page") {
          locationText = "Титульная страница (первая страница документа)";
          icon = "📋";
        }
        else if (it.location === "document") {
          locationText = "Основной текст документа";
          icon = "📄";
        }
        else if (it.location === "calendar_plan_table") {
          locationText = "Таблица календарного плана";
          icon = "📊";
        }
        else if (it.location.includes("page:")) {
          const pageNum = it.location.split(":")[1];
          locationText = `Страница ${pageNum} (перейдите на эту страницу в документе)`;
          icon = "📖";
        }
        else {
          locationText = it.location;
        }
        
        locationBadge = `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            padding: 6px 12px;
            background: rgba(15, 118, 110, 0.1);
            border-radius: 12px;
            font-size: 12px;
            color: var(--muted);
          ">
            <span style="font-size: 12px;">${icon}</span>
            <span>${locationText}</span>
          </div>
        `;
      }

      return `
        <div class="issue" style="animation-delay:${index * 60}ms">
          <div class="issue-head">
            <div class="sev ${dotClass(sev)}"><span class="dot ${dotClass(sev)}"></span>${sevLabel(sev)}</div>
            ${rule}
          </div>
          <div><b>${esc(it.message || "Нарушение")}</b></div>
          ${evidenceHint}
          ${locationBadge}
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

  // Добавляем секцию комментариев после основного отчёта
  const commentSectionHTML = `
    <div id="commentSection" class="card subcard" style="margin-top: 20px;">
      <div class="section-title">Комментарии к проверке</div>
      
      <div id="commentsList" class="comments-list" style="margin-bottom: 16px;">
        ${comments.length === 0 ? 
          '<div class="empty" style="border: none; background: transparent;">Комментариев пока нет</div>' : 
          comments.map((comment, index) => `
            <div class="comment-item">
              <div class="comment-header">
                <span>Комментарий #${index + 1}</span>
                <span class="comment-timestamp">${comment.timestamp}</span>
              </div>
              <div class="comment-text">${esc(comment.text)}</div>
            </div>
          `).join('')
        }
      </div>
      
      <div class="toolbar" style="border-top: 1px solid var(--line); padding-top: 16px;">
        <textarea id="newComment" placeholder="Добавьте комментарий к результатам проверки..." 
                  style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid var(--line); 
                         font-family: inherit; font-size: 14px; min-height: 80px;"></textarea>
        <button class="btn" id="addCommentBtn" style="align-self: flex-end;">Добавить</button>
        <button class="btn primary" id="downloadReportBtn">Скачать отчёт с комментариями</button>
      </div>
    </div>
  `;

  reportArea.insertAdjacentHTML('beforeend', commentSectionHTML);

  // Обработчики для кнопок комментариев
  document.getElementById('addCommentBtn').addEventListener('click', addComment);
  document.getElementById('downloadReportBtn').addEventListener('click', downloadReportWithComments);

  // Разрешаем добавлять комментарии по Enter (Ctrl+Enter)
  document.getElementById('newComment').addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      addComment();
    }
  });

}


function resetUI() {
  chosen = null;
  lastReport = null;
  comments = []; 
  currentFilter = "all";
  runEl.disabled = true;
  clearEl.disabled = true;
  metaEl.textContent = "Файл не выбран.";
  fileEl.value = "";
  renderEmpty("Загрузите документ и нажмите \"Проверить\".");
  
  const existingCommentSection = document.getElementById('commentSection');
  if (existingCommentSection) {
    existingCommentSection.remove();
  }
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

  // Валидация дополнительного поля
  //const orderNumberInput = document.getElementById('orderNumber');
  //const orderNumber = orderNumberInput ? orderNumberInput.value : '';
  //const validation = validateOrderNumber(orderNumber);
  
  //if (!validation.isValid) {
    //const proceed = confirm(`Обнаружены критические ошибки в номере приказа (${validation.errors.length}).\nВсё равно продолжить проверку документа?`);
    //if (!proceed) {
      // Показываем ошибки валидации
      //renderEmpty("Исправьте ошибки в номере приказа");
      //displayValidationResults(validation);
      //return;
    //}
  //}

  runEl.disabled = true;
  clearEl.disabled = true;
  renderLoading();

  try {
    const fd = new FormData();
    fd.append("file", chosen);
    
    //if (orderNumber.trim()) {
      //fd.append("order_number", orderNumber.trim());
    //}

    const profile = profileEl.value;
    const res = await fetch(`${API_BASE}/check?profile=${encodeURIComponent(profile)}`, {
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
    
    //displayValidationResults(validation);
    
    //if (validation.errors.length > 0 || validation.warnings.length > 0) {
      //if (!report.issues) report.issues = [];
      //report.issues.push(...validation.errors, ...validation.warnings);
      
      //if (!report.summary) report.summary = {critical:0, warning:0, info:0, total:0};
      //validation.errors.forEach(() => report.summary.critical++);
      //validation.warnings.forEach(() => report.summary.warning++);
      //report.summary.total = report.issues.length;
      
      //renderReport(report);
    //}
    
  } catch (e) {
    renderEmpty(`Ошибка соединения: ${e}`);
  } finally {
    runEl.disabled = false;
    clearEl.disabled = false;
  }
});

function validateOrderNumber(orderNumber) {
  const errors = [];
  const warnings = [];
  
  if (!orderNumber || orderNumber.trim() === '') {
    warnings.push({
      severity: "warning",
      message: "Не указан номер приказа/распоряжения",
      how_to_fix: "Рекомендуется указать номер официального документа для отчётности",
      rule: "ORDER_NUMBER_MISSING"
    });
    return { isValid: true, errors: errors, warnings: warnings };
  }
  
  const trimmed = orderNumber.trim();
  
  // Проверка длины
  if (trimmed.length < 3) {
    errors.push({
      severity: "critical",
      message: "Номер приказа слишком короткий",
      how_to_fix: "Номер должен содержать не менее 3 символов",
      rule: "ORDER_NUMBER_TOO_SHORT"
    });
  }
  
  // Проверка формата (пример: должен содержать номер и год)
  const formatRegex = /^[а-яА-Яa-zA-Z0-9\-\/\.\s]+\/\d{2,4}([-\/]\d{2,4})?$/;
  if (!formatRegex.test(trimmed)) {
    warnings.push({
      severity: "warning",
      message: "Номер приказа имеет нестандартный формат",
      how_to_fix: "Рекомендуемый формат: 'XXX/ГГГГ' или 'XXX/ГГГГ-ГГГГ' (например, '123/2024')",
      rule: "ORDER_NUMBER_FORMAT_WARNING"
    });
  }
  
  // Проверка на специальные символы (только разрешённые)
  const invalidCharRegex = /[<>#@$%^&*()+=|{}[\]:;"'`~]/;
  if (invalidCharRegex.test(trimmed)) {
    errors.push({
      severity: "critical",
      message: "Номер приказа содержит недопустимые символы",
      how_to_fix: "Удалите специальные символы: < > # @ $ % ^ & * ( ) + = | { } [ ] : ; \" ' ` ~",
      rule: "ORDER_NUMBER_INVALID_CHARS"
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

// Функция для отображения результата валидации
function displayValidationResults(validation) {
  const validationSection = document.createElement('div');
  validationSection.className = 'card subcard';
  validationSection.style.marginTop = '20px';
  validationSection.innerHTML = `
    <div class="section-title">Проверка номера приказа</div>
    <div class="muted small" style="margin-bottom: 12px;">
      Валидация дополнительного поля документа
    </div>
  `;
  
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    validationSection.innerHTML += `
      <div class="issue">
        <div class="issue-head">
          <div class="sev ok"><span class="dot ok"></span>Проверка пройдена</div>
        </div>
        <div><b>Номер приказа корректен</b></div>
        <div class="how">Все проверки пройдены успешно</div>
      </div>
    `;
  } else {
    // Показываем ошибки
    validation.errors.forEach(error => {
      validationSection.innerHTML += `
        <div class="issue" style="animation-delay: 0ms">
          <div class="issue-head">
            <div class="sev critical"><span class="dot critical"></span>Ошибка валидации</div>
            <div class="rule">${error.rule}</div>
          </div>
          <div><b>${error.message}</b></div>
          <div class="how">${error.how_to_fix}</div>
        </div>
      `;
    });
    
    // Показываем предупреждения
    validation.warnings.forEach(warning => {
      validationSection.innerHTML += `
        <div class="issue" style="animation-delay: 60ms">
          <div class="issue-head">
            <div class="sev warning"><span class="dot warning"></span>Предупреждение</div>
            <div class="rule">${warning.rule}</div>
          </div>
          <div><b>${warning.message}</b></div>
          <div class="how">${warning.how_to_fix}</div>
        </div>
      `;
    });
  }
  
  // Добавляем секцию валидации перед комментариями
  const commentSection = document.getElementById('commentSection');
  if (commentSection) {
    commentSection.insertAdjacentElement('beforebegin', validationSection);
  } else {
    reportArea.appendChild(validationSection);
  }
}

resetUI();
