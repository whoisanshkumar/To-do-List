/* ============================================
   TASKFLOW v2 – Smart Frontend JS
   ============================================ */

// ── State ─────────────────────────────────────
let allTasks       = [];
let currentFilter  = 'all';
let selectedPriority = 'medium';
let isFocusMode    = false;
let editingId      = null;

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchTasks();
  document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Set min date for due-date input to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('due-date-input').min = today;
});

// ── Fetch Tasks ───────────────────────────────
async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    allTasks  = await res.json();
    renderTasks();
  } catch {
    showToast('⚠️ Could not load tasks');
  }
}

// ── Priority Selector ─────────────────────────
function setPriority(p) {
  selectedPriority = p;
  document.querySelectorAll('.priority-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.p === p);
  });
}

// ── Add Task ──────────────────────────────────
async function addTask() {
  const input   = document.getElementById('task-input');
  const dueEl   = document.getElementById('due-date-input');
  const title   = input.value.trim();

  if (!title) {
    input.style.animation = 'none';
    input.offsetHeight;
    input.style.animation = 'shake .4s ease';
    setTimeout(() => { input.style.animation = ''; }, 400);
    showToast('✏️ Please enter a task title');
    return;
  }

  try {
    const res  = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        priority: selectedPriority,
        due_date: dueEl.value || ''
      })
    });
    const task = await res.json();
    allTasks.push(task);
    sortTasksLocally();
    input.value = '';
    dueEl.value = '';
    renderTasks();
    showToast('✅ Task added!');
  } catch {
    showToast('❌ Failed to add task');
  }
}

// ── Toggle Complete ───────────────────────────
async function toggleTask(id) {
  try {
    const res  = await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
    const task = await res.json();
    const idx  = allTasks.findIndex(t => t.id === id);
    if (idx !== -1) allTasks[idx] = task;
    sortTasksLocally();
    renderTasks();
    showToast(task.completed ? '🎉 Task completed!' : '↩️ Marked as active');
  } catch {
    showToast('❌ Failed to update task');
  }
}

// ── Delete Task ───────────────────────────────
async function deleteTask(id) {
  if (editingId === id) cancelEdit();
  const card = document.getElementById('task-' + id);
  if (card) card.classList.add('removing');

  setTimeout(async () => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      allTasks = allTasks.filter(t => t.id !== id);
      renderTasks();
      showToast('🗑️ Task deleted');
    } catch {
      showToast('❌ Failed to delete');
    }
  }, 260);
}

// ── Inline Edit ───────────────────────────────
function startEdit(id) {
  if (editingId && editingId !== id) cancelEdit();
  editingId = id;

  const task     = allTasks.find(t => t.id === id);
  const titleEl  = document.getElementById('title-' + id);
  const actionsEl = document.getElementById('actions-' + id);
  if (!titleEl || !task) return;

  // Replace span with input
  const input = document.createElement('input');
  input.type      = 'text';
  input.value     = task.title;
  input.className = 'edit-input';
  input.id        = 'edit-input-' + id;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // Swap action buttons
  actionsEl.innerHTML = `
    <button class="action-btn save-btn" onclick="saveEdit(${id})" title="Save">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
    <button class="action-btn" onclick="cancelEdit()" title="Cancel" style="color:#94a3b8;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveEdit(id);
    if (e.key === 'Escape') cancelEdit();
  });
}

async function saveEdit(id) {
  const input = document.getElementById('edit-input-' + id);
  if (!input) return;
  const newTitle = input.value.trim();
  if (!newTitle) { showToast('✏️ Title cannot be empty'); return; }

  try {
    const res  = await fetch(`/api/tasks/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
    const task = await res.json();
    const idx  = allTasks.findIndex(t => t.id === id);
    if (idx !== -1) allTasks[idx] = task;
    editingId = null;
    renderTasks();
    showToast('✏️ Task updated!');
  } catch {
    showToast('❌ Failed to save edit');
  }
}

function cancelEdit() {
  editingId = null;
  renderTasks();
}

// ── Focus Mode ────────────────────────────────
function toggleFocusMode() {
  isFocusMode = !isFocusMode;
  document.body.classList.toggle('focus-mode', isFocusMode);

  const btn    = document.getElementById('focus-btn');
  const banner = document.getElementById('focus-banner');
  btn.classList.toggle('active', isFocusMode);
  banner.classList.toggle('hidden', !isFocusMode);

  if (isFocusMode) {
    currentFilter = 'active';
    showToast('🎯 Focus Mode ON – stay locked in!');
  } else {
    currentFilter = 'all';
    // Restore filter tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-all').classList.add('active');
    showToast('👋 Focus Mode OFF');
  }
  renderTasks();
}

// ── Filter ────────────────────────────────────
function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + filter).classList.add('active');
  renderTasks();
}

// ── Sort locally (mirror backend logic) ───────
function sortTasksLocally() {
  const pOrder = { high: 0, medium: 1, low: 2 };
  allTasks.sort((a, b) => {
    const ca = a.completed ? 1 : 0, cb = b.completed ? 1 : 0;
    if (ca !== cb) return ca - cb;
    const pa = pOrder[a.priority || 'medium'], pb = pOrder[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;
    const da = a.due_date || '9999-12-31', db = b.due_date || '9999-12-31';
    return da.localeCompare(db);
  });
}

// ── Due Date Helpers ──────────────────────────
function getDueDateBadge(dueDateStr) {
  if (!dueDateStr) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  const diff  = Math.round((due - today) / 86400000);

  if (diff < 0)  return `<span class="due-badge overdue">🔴 Overdue by ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="due-badge due-today">⚡ Due Today</span>`;
  if (diff === 1) return `<span class="due-badge due-soon">🕐 Due Tomorrow</span>`;
  if (diff <= 3)  return `<span class="due-badge due-soon">🕐 Due in ${diff}d</span>`;
  return `<span class="due-badge due-later">📅 ${formatDate(dueDateStr)}</span>`;
}

function isOverdue(dueDateStr, completed) {
  if (!dueDateStr || completed) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}`;
}

// ── Priority label ────────────────────────────
function priorityLabel(p) {
  return { high: 'High', medium: 'Med', low: 'Low' }[p] || 'Med';
}

// ── Motivational Message ──────────────────────
function getMotivationalMsg(pct) {
  if (pct === 0)   return "Let's start 🚀";
  if (pct < 25)    return "Great start, keep going! 💪";
  if (pct < 50)    return "You're warming up 🔥";
  if (pct === 50)  return "Halfway there, push it! ⚡";
  if (pct < 75)    return "More than halfway done! 🎯";
  if (pct < 100)   return "Almost there, don't stop! 🏁";
  return "You crushed it! 💯";
}

// ── Render Tasks ──────────────────────────────
function renderTasks() {
  const container = document.getElementById('tasks-container');
  const emptyEl   = document.getElementById('empty-state');
  const emptyMsg  = document.getElementById('empty-msg');
  const progSec   = document.getElementById('progress-section');

  const total = allTasks.length;
  const done  = allTasks.filter(t => t.completed).length;

  // Stats
  document.getElementById('total-count').textContent = `${total} task${total !== 1 ? 's' : ''}`;
  document.getElementById('done-count').textContent  = `${done} done`;

  // Progress
  if (total > 0) {
    const pct = Math.round((done / total) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-pct').textContent = pct + '%';
    document.getElementById('progress-summary').textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} done`;
    document.getElementById('progress-message').textContent = getMotivationalMsg(pct);
    progSec.classList.remove('hidden');
  } else {
    progSec.classList.add('hidden');
  }

  // Filter
  let visible = [...allTasks];
  if (currentFilter === 'active')    visible = visible.filter(t => !t.completed);
  if (currentFilter === 'completed') visible = visible.filter(t => t.completed);

  // Empty state
  if (visible.length === 0) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    if (total === 0) {
      emptyMsg.textContent = 'Start small. One task is enough 🚀';
    } else if (currentFilter === 'active') {
      emptyMsg.textContent = "All caught up — you're on fire! 🔥";
    } else {
      emptyMsg.textContent = 'No completed tasks yet. Keep pushing!';
    }
    return;
  }

  emptyEl.classList.add('hidden');

  container.innerHTML = visible.map(task => {
    const p        = task.priority || 'medium';
    const overdue  = isOverdue(task.due_date, task.completed);
    const dueBadge = getDueDateBadge(task.due_date);

    return `
    <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}"
         id="task-${task.id}" data-priority="${p}">

      <div class="checkbox-wrap" onclick="toggleTask(${task.id})">
        <div class="checkbox ${task.completed ? 'checked' : ''}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <div class="task-body">
        <div class="task-top-row">
          <span class="task-title ${task.completed ? 'done' : ''}" id="title-${task.id}">${escapeHtml(task.title)}</span>
          <span class="priority-badge p-${p}">${priorityLabel(p)}</span>
        </div>
        <div class="task-bottom-row">
          ${dueBadge}
          <span class="task-date">${task.created_at}</span>
        </div>
      </div>

      <div class="task-actions" id="actions-${task.id}">
        <button class="action-btn" onclick="startEdit(${task.id})" title="Edit task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn" onclick="deleteTask(${task.id})" title="Delete task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"></path>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Toast ─────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 350);
  }, 2600);
}

// ── Escape HTML ───────────────────────────────
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
