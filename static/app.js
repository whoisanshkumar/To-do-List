/* ============================================================
   TASKFLOW – app.js (Supabase edition)
   All /api/* calls replaced with direct Supabase calls.
   ============================================================ */

import { fetchTasks as sbFetch, addTask as sbAdd, deleteTask as sbDelete }
  from "../supabase.js";

// ── State ─────────────────────────────────────────────────
let allTasks      = [];
let currentFilter = "all";
let isFocusMode   = false;

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadTasks();                         // 4. Load tasks on page load

  document.getElementById("taskInput").addEventListener("keydown", e => {
    if (e.key === "Enter") addTask();
  });
});

// ── Load / Fetch tasks ────────────────────────────────────
async function loadTasks() {
  try {
    allTasks = await sbFetch();        // 2. Fetch all tasks from Supabase
    renderTasks();
  } catch (err) {
    console.log("loadTasks error:", err);
    showToast("⚠️ Could not load tasks");
  }
}

// ── Add Task ─────────────────────────────────────────────
window.addTask = async function addTask() {
  const input = document.getElementById("taskInput");
  const title = input.value.trim();

  if (!title) {
    input.style.animation = "none";
    input.offsetHeight;                // force reflow
    input.style.animation = "shake .4s ease";
    setTimeout(() => { input.style.animation = ""; }, 400);
    showToast("✏️ Please enter a task title");
    return;
  }

  try {
    const task = await sbAdd(title);   // 1. Add task → stored in Supabase
    if (!task) throw new Error("null response");

    allTasks.unshift(task);            // prepend (newest first)
    input.value = "";
    renderTasks();                     // 3. Auto-refresh UI after adding
    showToast("✅ Task added!");
  } catch (err) {
    console.log("addTask error:", err);
    showToast("❌ Failed to add task");
  }
};

// ── Toggle Complete (local only – no DB column) ──────────
window.toggleTask = function toggleTask(id) {
  const idx = allTasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  allTasks[idx].completed = !allTasks[idx].completed;
  renderTasks();
  showToast(allTasks[idx].completed ? "🎉 Task completed!" : "↩️ Marked as active");
};

// ── Delete Task ───────────────────────────────────────────
window.deleteTask = async function deleteTask(id) {
  const card = document.getElementById("task-" + id);
  if (card) card.classList.add("removing");

  setTimeout(async () => {
    try {
      const ok = await sbDelete(id);
      if (!ok) throw new Error("delete failed");
      allTasks = allTasks.filter(t => t.id !== id);
      renderTasks();
      showToast("🗑️ Task deleted");
    } catch (err) {
      console.log("deleteTask error:", err);
      showToast("❌ Failed to delete");
    }
  }, 260);
};

// ── Filter ────────────────────────────────────────────────
window.filterTasks = function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("tab-" + filter).classList.add("active");
  renderTasks();
};

// ── Focus Mode ────────────────────────────────────────────
window.toggleFocusMode = function toggleFocusMode() {
  isFocusMode = !isFocusMode;
  document.body.classList.toggle("focus-mode", isFocusMode);

  const btn    = document.getElementById("focus-btn");
  const banner = document.getElementById("focus-banner");
  btn.classList.toggle("active", isFocusMode);
  banner.classList.toggle("hidden", !isFocusMode);

  if (isFocusMode) {
    currentFilter = "active";
    showToast("🎯 Focus Mode ON – stay locked in!");
  } else {
    currentFilter = "all";
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-all").classList.add("active");
    showToast("👋 Focus Mode OFF");
  }
  renderTasks();
};

// ── Motivational Message ──────────────────────────────────
function getMotivationalMsg(pct) {
  if (pct === 0)  return "Let's start 🚀";
  if (pct < 25)   return "Great start, keep going! 💪";
  if (pct < 50)   return "You're warming up 🔥";
  if (pct === 50) return "Halfway there, push it! ⚡";
  if (pct < 75)   return "More than halfway done! 🎯";
  if (pct < 100)  return "Almost there, don't stop! 🏁";
  return "You crushed it! 💯";
}

// ── Render Tasks ──────────────────────────────────────────
function renderTasks() {
  const container = document.getElementById("taskList");
  const emptyEl   = document.getElementById("empty-state");
  const emptyMsg  = document.getElementById("empty-msg");
  const progSec   = document.getElementById("progress-section");

  const total = allTasks.length;
  const done  = allTasks.filter(t => t.completed).length;

  // Header stats
  document.getElementById("total-count").textContent =
    `${total} task${total !== 1 ? "s" : ""}`;
  document.getElementById("done-count").textContent = `${done} done`;

  // Progress bar
  if (total > 0) {
    const pct = Math.round((done / total) * 100);
    document.getElementById("progress-bar").style.width = pct + "%";
    document.getElementById("progress-pct").textContent = pct + "%";
    document.getElementById("progress-summary").textContent =
      `${done} of ${total} task${total !== 1 ? "s" : ""} done`;
    document.getElementById("progress-message").textContent =
      getMotivationalMsg(pct);
    progSec.classList.remove("hidden");
  } else {
    progSec.classList.add("hidden");
  }

  // Filter
  let visible = [...allTasks];
  if (currentFilter === "active")    visible = visible.filter(t => !t.completed);
  if (currentFilter === "completed") visible = visible.filter(t => t.completed);

  // Empty state
  if (visible.length === 0) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    if (total === 0) {
      emptyMsg.textContent = "Start small. One task is enough 🚀";
    } else if (currentFilter === "active") {
      emptyMsg.textContent = "All caught up — you're on fire! 🔥";
    } else {
      emptyMsg.textContent = "No completed tasks yet. Keep pushing!";
    }
    return;
  }

  emptyEl.classList.add("hidden");

  container.innerHTML = visible.map(task => `
    <div class="task-card ${task.completed ? "completed" : ""}"
         id="task-${task.id}">

      <div class="checkbox-wrap" onclick="toggleTask(${task.id})">
        <div class="checkbox ${task.completed ? "checked" : ""}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <div class="task-body">
        <div class="task-top-row">
          <span class="task-title ${task.completed ? "done" : ""}"
                id="title-${task.id}">${escapeHtml(task.title)}</span>
        </div>
        <div class="task-bottom-row">
          <span class="task-date">${task.created_at}</span>
        </div>
      </div>

      <div class="task-actions" id="actions-${task.id}">
        <button class="action-btn delete-btn"
                onclick="deleteTask(${task.id})" title="Delete task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"></path>
          </svg>
        </button>
      </div>
    </div>`
  ).join("");
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 350);
  }, 2600);
}

// ── Escape HTML ───────────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
