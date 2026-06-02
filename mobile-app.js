/* ===================================================================
   TASK TRACKER — mobile
   3 swipe pages: tasks / recurring / calendar
   - lists scroll on top, compact sticky input bar at the bottom
   - calendar uses a bottom sheet for day tasks + month-all view
   Same data model & logic as the desktop app.
=================================================================== */

// ---- shared helpers ----------------------------------------------
const pad = (n) => String(n).padStart(2, '0');

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target - now) / 86400000);
}
function etaText(iso) {
  const d = daysUntil(iso);
  if (d === null || d < 0) return 'past due date';
  if (d === 0) return 'today';
  if (d === 1) return '1 day';
  if (d < 45) return d + ' days';
  const months = Math.round(d / 30);
  return '~' + months + ' month' + (months > 1 ? 's' : '');
}
function dueText(iso) {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d < 0) return 'overdue ' + Math.abs(d) + 'd';
  if (d === 0) return 'due today';
  const dt = new Date(iso + 'T00:00:00');
  return 'due ' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1);
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function todayISO() {
  const n = new Date();
  return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
}
const CHECK_SVG = '<path d="M4 13 C 7 16, 9 18, 10 19 C 13 13, 17 7, 21 4" fill="none" stroke="#3f8f5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
const TRASH_SVG = '<svg viewBox="0 0 24 24"><path d="M4 6 H20 M9 6 V4 H15 V6 M6 6 L7 20 H17 L18 6" fill="none" stroke="#2b2b28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ===================================================================
   TASKS
=================================================================== */
const STORE_KEY = 'task-tracker.tasks';
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { return []; }
}
function save() {
  try {
    const clean = tasks.map(({ confirming, ...rest }) => rest);
    localStorage.setItem(STORE_KEY, JSON.stringify(clean));
  } catch (e) {}
}
let tasks = load();
let seq = 0;

function addTask(name, deadline) {
  tasks.push({
    id: Date.now() + '' + Math.floor(Math.random() * 1000),
    name, deadline, done: false, seq: 0,
  });
  save(); render();
}
function toggleTask(id) {
  const t = tasks.find((t) => t.id === id);
  if (!t) return;
  t.done = !t.done;
  t.seq = t.done ? ++seq : 0;
  save(); render();
}
function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  save(); render();
}

const listEl   = document.getElementById('task-list');
const countsEl = document.getElementById('counts');

function taskRowHTML(t) {
  const d = daysUntil(t.deadline);
  const soon = !t.done && d !== null && d >= 0 && d <= 2;
  const over = !t.done && d !== null && d < 0;
  const eta  = t.done ? '' : etaText(t.deadline);
  const meta =
    (eta ? 'eta ' + eta : '') +
    (t.deadline ? (eta ? ' · ' : '') + '<span class="m-due ' + (soon ? 'soon' : '') + (over ? 'over' : '') + '">' + dueText(t.deadline) + '</span>' : '');

  return (
    '<li class="task ' + (t.done ? 'done' : '') + '">' +
      '<div class="task-body">' +
        '<span class="task-name">' + escapeHtml(t.name) + '</span>' +
        (meta ? '<span class="task-meta">' + meta + '</span>' : '') +
      '</div>' +
      (t.done ? '<span class="stamp">DONE</span>' : '') +
      (t.confirming
        ? '<div class="confirm-btns">' +
            '<button class="confirm-no"  data-action="cancel-delete" data-id="' + t.id + '">no</button>' +
            '<button class="confirm-yes" data-action="confirm-delete" data-id="' + t.id + '">yes</button>' +
          '</div>'
        : '<button class="trash-btn" data-action="delete" data-id="' + t.id + '" aria-label="delete">' + TRASH_SVG + '</button>') +
      '<button class="checkbox sketch" data-action="toggle" data-id="' + t.id + '" style="' + (t.done ? 'border-color:#3f8f5b' : '') + '" aria-label="toggle done">' +
        '<svg viewBox="0 0 24 24">' + (t.done ? CHECK_SVG : '') + '</svg>' +
      '</button>' +
    '</li>'
  );
}

function render() {
  const active = tasks.filter((t) => !t.done);
  const done   = tasks.filter((t) => t.done);
  active.sort((a, b) => {
    const da = daysUntil(a.deadline), db = daysUntil(b.deadline);
    if (da === null) return db === null ? 0 : 1;
    if (db === null) return -1;
    return da - db;
  });
  done.sort((a, b) => b.seq - a.seq);
  done.forEach((t) => { if (t.seq > seq) seq = t.seq; });

  let html = '';
  if (tasks.length === 0) {
    html = '<li class="empty">nothing here yet — add a task below.</li>';
  } else {
    html += active.map(taskRowHTML).join('');
    if (done.length) html += '<li class="group-sep">completed</li>';
    html += done.map(taskRowHTML).join('');
  }
  listEl.innerHTML = html;

  countsEl.innerHTML =
    '<b>' + active.length + '</b> active <span class="dot">·</span> ' +
    '<b style="color:#3f8f5b">' + done.length + '</b> done';

  renderCalendar();
  refreshSheet();
}

// delegated task actions (works for main list AND the bottom sheet)
function handleTaskClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'toggle') toggleTask(id);
  if (btn.dataset.action === 'delete') {
    const task = tasks.find((t) => t.id === id);
    if (task && !task.done) { task.confirming = true; render(); }
    else deleteTask(id);
  }
  if (btn.dataset.action === 'confirm-delete') deleteTask(id);
  if (btn.dataset.action === 'cancel-delete') {
    const task = tasks.find((t) => t.id === id);
    if (task) { task.confirming = false; render(); }
  }
}
listEl.addEventListener('click', handleTaskClick);

// ---- bottom input bar: deadline picker ----------------------------
const nameInput = document.getElementById('name-input');
const dateInput = document.getElementById('date-input');
const dateBtn   = document.getElementById('date-btn');
const etaPrev   = document.getElementById('eta-preview');

// the native <input type="date"> sits invisibly on top of the icon,
// so a tap opens the OS date picker directly (no showPicker needed).
dateInput.addEventListener('change', () => {
  if (dateInput.value) {
    dateBtn.classList.add('set');
    etaPrev.textContent = 'deadline ' + dueText(dateInput.value) + ' · eta ' + etaText(dateInput.value);
    etaPrev.classList.add('show');
  } else {
    dateBtn.classList.remove('set');
    etaPrev.classList.remove('show');
  }
});

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  addTask(name, dateInput.value || '');
  nameInput.value = '';
  dateInput.value = '';
  dateBtn.classList.remove('set');
  etaPrev.classList.remove('show');
  nameInput.focus();
});

/* ===================================================================
   RECURRING
=================================================================== */
const REC_KEY = 'task-tracker.recurring';
function loadRec() {
  try { return JSON.parse(localStorage.getItem(REC_KEY)) || []; }
  catch (e) { return []; }
}
function saveRec() {
  try { localStorage.setItem(REC_KEY, JSON.stringify(recurring)); } catch (e) {}
}
let recurring = loadRec();
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function isRecDueToday(r) {
  const today = todayISO();
  const dow   = new Date().getDay();
  if (r.freq === 'daily')    return !r.lastDone || r.lastDone < today;
  if (r.freq === 'weekdays') return dow >= 1 && dow <= 5 && (!r.lastDone || r.lastDone < today);
  if (r.freq === 'weekly')   return dow === r.weekday && (!r.lastDone || r.lastDone < today);
  if (r.freq === 'monthly') {
    if (!r.lastDone) return true;
    const ld = new Date(r.lastDone + 'T00:00:00'), td = new Date();
    return ld.getFullYear() !== td.getFullYear() || ld.getMonth() !== td.getMonth();
  }
  return false;
}
function recLabel(r) {
  return r.freq === 'weekly' ? 'weekly · ' + DAYS[r.weekday].slice(0, 3) : r.freq;
}
function addRecurring(name, freq, weekday) {
  recurring.push({
    id: Date.now() + '' + Math.floor(Math.random() * 1000),
    name, freq,
    weekday: freq === 'weekly' ? weekday : 0,
    lastDone: '',
  });
  saveRec(); renderRec();
}
function tickRecurring(id) {
  const r = recurring.find((r) => r.id === id);
  if (!r) return;
  r.lastDone = todayISO();
  saveRec(); renderRec();
}
function deleteRecurring(id) {
  recurring = recurring.filter((r) => r.id !== id);
  saveRec(); renderRec();
}

const recListEl = document.getElementById('rec-list');
function recRowHTML(r) {
  const due       = isRecDueToday(r);
  const doneToday = r.lastDone === todayISO();
  const badgeClass = due ? 'due' : doneToday ? 'done-t' : 'not-today';
  const badgeText  = due ? recLabel(r) + ' · due' : doneToday ? 'done today' : recLabel(r);
  return (
    '<li class="rec-task">' +
      '<div class="rec-body">' +
        '<div class="rec-name">' + escapeHtml(r.name) + '</div>' +
        '<span class="rec-badge ' + badgeClass + '">' + escapeHtml(badgeText) + '</span>' +
      '</div>' +
      '<button class="rec-trash" data-raction="delete" data-rid="' + r.id + '" aria-label="delete">' + TRASH_SVG + '</button>' +
      '<button class="rec-tick sketch" data-raction="tick" data-rid="' + r.id + '"' + (doneToday ? ' disabled' : '') + ' aria-label="tick">' +
        '<svg viewBox="0 0 24 24">' + (doneToday ? CHECK_SVG : '') + '</svg>' +
      '</button>' +
    '</li>'
  );
}
function renderRec() {
  if (recurring.length === 0) {
    recListEl.innerHTML = '<li class="empty">no habits yet — add one below.</li>';
    return;
  }
  const sorted = [...recurring].sort((a, b) => {
    const ad = isRecDueToday(a), bd = isRecDueToday(b);
    if (ad !== bd) return ad ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  recListEl.innerHTML = sorted.map(recRowHTML).join('');
}
recListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-raction]');
  if (!btn) return;
  const id = btn.dataset.rid;
  if (btn.dataset.raction === 'tick')   tickRecurring(id);
  if (btn.dataset.raction === 'delete') deleteRecurring(id);
});

// ---- frequency dropdown -------------------------------------------
function initDrop(dropEl, onChange) {
  const trigger = dropEl.querySelector('.ink-drop-trigger');
  const opts    = dropEl.querySelectorAll('.ink-drop-menu button');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ink-drop.open').forEach((d) => { if (d !== dropEl) d.classList.remove('open'); });
    dropEl.classList.toggle('open');
  });
  opts.forEach((opt) => {
    opt.addEventListener('click', () => {
      const val  = opt.dataset.dropval;
      const text = opt.textContent.trim();
      trigger.dataset.value = val;
      trigger.firstChild.textContent = text + ' ';
      opts.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      dropEl.classList.remove('open');
      if (onChange) onChange(val);
    });
  });
}
document.addEventListener('click', () => {
  document.querySelectorAll('.ink-drop.open').forEach((d) => d.classList.remove('open'));
});
const freqDrop = document.getElementById('freq-drop');
const dayDrop  = document.getElementById('day-drop');
// when "weekly" is picked, reveal the weekday picker
initDrop(freqDrop, (val) => { dayDrop.style.display = val === 'weekly' ? '' : 'none'; });
initDrop(dayDrop, (val) => {
  // show the short label (mon/tue/…) on the trigger
  const full = dayDrop.querySelector('.ink-drop-menu button.active');
  const trigger = dayDrop.querySelector('.ink-drop-trigger');
  trigger.firstChild.textContent = (full ? full.textContent.trim().slice(0, 3) : 'mon') + ' ';
});

document.getElementById('rec-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const nameEl = document.getElementById('rec-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  const freq = freqDrop.querySelector('.ink-drop-trigger').dataset.value;
  const weekday = parseInt(dayDrop.querySelector('.ink-drop-trigger').dataset.value, 10);
  addRecurring(name, freq, weekday);
  nameEl.value = '';
  nameEl.focus();
});

/* ===================================================================
   CALENDAR (month grid + bottom sheet)
=================================================================== */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FULL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
let calYear, calMonth;
let selectedDay = null;

(function initCal() {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
})();

function dayISOfrom(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

function renderCalendar() {
  const monthEl = document.getElementById('cal-month');
  const gridEl  = document.getElementById('cal-grid');
  if (!gridEl) return;
  monthEl.innerHTML = MONTHS[calMonth] + ' ' + calYear + ' <span class="mini-caret">▾</span>';

  const first = new Date(calYear, calMonth, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayISO();

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell blank"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = dayISOfrom(calYear, calMonth, d);
    const dayTasks = tasks.filter((t) => t.deadline === iso);
    const hasActive = dayTasks.some((t) => !t.done);
    const hasDone   = dayTasks.some((t) => t.done);
    const isToday = iso === today;
    const isPast  = iso < today;
    const isSel   = iso === selectedDay;

    let dots = '';
    if (hasActive) dots += '<span class="cal-dot active"></span>';
    if (hasDone)   dots += '<span class="cal-dot done"></span>';

    cells +=
      '<div class="cal-cell' +
        (dayTasks.length ? ' has' : '') +
        (isToday ? ' today' : '') + (isPast ? ' past' : '') + (isSel ? ' selected' : '') +
        '" data-cal-iso="' + iso + '">' +
        '<span>' + d + '</span>' +
        '<span class="cal-dots">' + dots + '</span>' +
      '</div>';
  }
  gridEl.innerHTML = cells;
}

document.getElementById('cal-grid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell[data-cal-iso]');
  if (!cell) return;
  selectedDay = cell.dataset.calIso;
  renderCalendar();
  openDaySheet(selectedDay);
});
document.getElementById('cal-month').addEventListener('click', openMonthSheet);
document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

/* ===================================================================
   BOTTOM SHEET
=================================================================== */
const backdrop  = document.getElementById('sheet-backdrop');
const sheet     = document.getElementById('bottom-sheet');
const sheetTitle = document.getElementById('sheet-title');
const sheetList = document.getElementById('sheet-list');
let sheetCtx = null; // {type:'day', iso} | {type:'month'}

function openSheet() { backdrop.classList.add('open'); sheet.classList.add('open'); }
function closeSheet() { backdrop.classList.remove('open'); sheet.classList.remove('open'); sheetCtx = null; }

function dayHeading(iso) {
  const dt = new Date(iso + 'T00:00:00');
  const isToday = iso === todayISO();
  return (isToday ? 'today · ' : '') +
    FULL_DAYS[dt.getDay()].toLowerCase() + ' ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()].toLowerCase();
}

function openDaySheet(iso) {
  sheetCtx = { type: 'day', iso };
  buildSheet();
  openSheet();
}
function openMonthSheet() {
  sheetCtx = { type: 'month' };
  buildSheet();
  openSheet();
}

function buildSheet() {
  if (!sheetCtx) return;
  if (sheetCtx.type === 'day') {
    sheetTitle.textContent = dayHeading(sheetCtx.iso);
    const dayTasks = tasks
      .filter((t) => t.deadline === sheetCtx.iso)
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    sheetList.innerHTML = dayTasks.length
      ? dayTasks.map(taskRowHTML).join('')
      : '<li class="empty">no tasks due this day.</li>';
  } else {
    const prefix = calYear + '-' + pad(calMonth + 1);
    const monthTasks = tasks
      .filter((t) => t.deadline && t.deadline.indexOf(prefix) === 0)
      .sort((a, b) => {
        if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
        return (a.done ? 1 : 0) - (b.done ? 1 : 0);
      });
    const activeN = monthTasks.filter((t) => !t.done).length;
    sheetTitle.innerHTML = MONTHS[calMonth] + ' ' + calYear +
      '<span class="sheet-sub">' + monthTasks.length + ' task' + (monthTasks.length === 1 ? '' : 's') +
      ' · ' + activeN + ' to do</span>';

    if (!monthTasks.length) {
      sheetList.innerHTML = '<li class="empty">no tasks due this month.</li>';
    } else {
      let html = '';
      let lastDay = '';
      monthTasks.forEach((t) => {
        if (t.deadline !== lastDay) {
          lastDay = t.deadline;
          html += '<li class="sheet-daysep">' + dayHeading(t.deadline) + '</li>';
        }
        html += taskRowHTML(t);
      });
      sheetList.innerHTML = html;
    }
  }
}

// keep the sheet contents fresh after toggling/deleting from inside it
function refreshSheet() {
  if (sheetCtx && sheet.classList.contains('open')) buildSheet();
}

sheetList.addEventListener('click', handleTaskClick);
backdrop.addEventListener('click', closeSheet);
document.getElementById('sheet-close').addEventListener('click', closeSheet);

/* ===================================================================
   SWIPE DECK + TAB BAR
=================================================================== */
const pagesEl = document.getElementById('pages');
const tabs = [...document.querySelectorAll('.tab')];

function goToPage(i) {
  pagesEl.scrollTo({ left: i * pagesEl.clientWidth, behavior: 'smooth' });
}
tabs.forEach((tab) => {
  tab.addEventListener('click', () => goToPage(parseInt(tab.dataset.page, 10)));
});

let scrollRAF = null;
pagesEl.addEventListener('scroll', () => {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(() => {
    scrollRAF = null;
    const idx = Math.round(pagesEl.scrollLeft / pagesEl.clientWidth);
    tabs.forEach((t, i) => t.classList.toggle('active', i === idx));
  });
});
window.addEventListener('resize', () => {
  const idx = tabs.findIndex((t) => t.classList.contains('active'));
  if (idx >= 0) pagesEl.scrollLeft = idx * pagesEl.clientWidth;
});

/* ---- first paint ---- */
render();
renderRec();
renderCalendar();
