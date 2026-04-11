/* ============================================================
   TASKFLOW v3 – app.js (Full-stack Supabase edition)
   Phase 1: Core Features (delete, toggle, edit, due, priority)
   Phase 2: UX (filters, search, animations, dark/light mode)
   Phase 3: Auth (sign up, login, logout, per-user tasks)
   ============================================================ */

import {
  // Auth
  signUp, signIn, signOut, getSession, getCurrentUser, onAuthStateChange,
  // Tasks
  fetchTasks as sbFetch,
  addTask    as sbAdd,
  toggleTask as sbToggle,
  updateTask as sbUpdate,
  deleteTask as sbDelete,
} from "../supabase.js";

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let allTasks      = [];
let currentFilter = "all";
let searchQuery   = "";
let isFocusMode   = false;
let currentUser   = null;
let pendingDeleteId = null;

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  // Theme persistence
  const saved = localStorage.getItem("tf-theme") || "dark";
  applyTheme(saved);

  // Wire Enter key for task input
  document.getElementById("taskInput").addEventListener("keydown", e => {
    if (e.key === "Enter") addTask();
  });

  // Wire Enter key for auth forms
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("signup-password").addEventListener("keydown", e => {
    if (e.key === "Enter") handleSignup();
  });

  // Close user dropdown on outside click
  document.addEventListener("click", e => {
    const menu = document.getElementById("user-menu");
    if (!menu.contains(e.target)) closeUserMenu();
  });

  // Close confirm dialog on overlay click
  document.getElementById("confirm-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeConfirm();
  });

  // Wire confirm delete button
  document.getElementById("confirm-ok").addEventListener("click", async () => {
    if (pendingDeleteId !== null) {
      closeConfirm();
      await executeDelete(pendingDeleteId);
    }
  });

  // ── Auth state management ────────────────────────────────
  // Strategy: use onAuthStateChange as the single source of truth.
  // getSession() is called once to bootstrap on page load.
  // A guard flag prevents double loadTasks() if both fire in quick succession.
  let sessionBootstrapped = false;

  onAuthStateChange(async (session) => {
    console.log("[auth] state change:", session?.user?.email ?? "logged out");
    if (session?.user) {
      currentUser = session.user;
      showApp();
      if (!sessionBootstrapped) {
        // getSession() will handle the first load below
        // but if it already ran and set the flag, skip
      }
      // Always load/refresh tasks on any auth change
      await loadTasks();
    } else {
      currentUser = null;
      allTasks = [];
      showAuthOverlay();
    }
    sessionBootstrapped = true;
  });

  // Bootstrap: check existing session on page load
  console.log("[init] checking existing session...");
  const session = await getSession();
  if (session?.user) {
    console.log("[init] session found:", session.user.email);
    currentUser = session.user;
    showApp();
    await loadTasks();
  } else {
    console.log("[init] no session, showing auth overlay");
    showAuthOverlay();
  }
  sessionBootstrapped = true;
});


// ═══════════════════════════════════════════════════════════
// AUTH UI FLOW
// ═══════════════════════════════════════════════════════════

window.switchAuthTab = function(tab) {
  const isLogin = tab === "login";

  document.getElementById("tab-login").classList.toggle("active", isLogin);
  document.getElementById("tab-signup").classList.toggle("active", !isLogin);
  document.getElementById("panel-login").classList.toggle("hidden", !isLogin);
  document.getElementById("panel-signup").classList.toggle("hidden", isLogin);

  document.getElementById("tab-login").setAttribute("aria-selected", String(isLogin));
  document.getElementById("tab-signup").setAttribute("aria-selected", String(!isLogin));

  // Clear errors
  clearAuthErrors();
};

window.handleLogin = async function() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const err      = document.getElementById("login-error");

  if (!email || !password) {
    showAuthError(err, "Please enter your email and password.");
    return;
  }

  setAuthLoading("login", true);
  try {
    const { user } = await signIn(email, password);
    currentUser = user;
    showApp();
    await loadTasks();
  } catch (e) {
    showAuthError(err, e.message || "Login failed. Check your credentials.");
  } finally {
    setAuthLoading("login", false);
  }
};

window.handleSignup = async function() {
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const err      = document.getElementById("signup-error");
  const success  = document.getElementById("signup-success");

  if (!email || !password) {
    showAuthError(err, "Please fill in all fields.");
    return;
  }
  if (password.length < 6) {
    showAuthError(err, "Password must be at least 6 characters.");
    return;
  }

  setAuthLoading("signup", true);
  try {
    await signUp(email, password);
    err.classList.add("hidden");
    success.textContent = "✅ Account created! Check your email to confirm, or try signing in.";
    success.classList.remove("hidden");
    document.getElementById("signup-email").value = "";
    document.getElementById("signup-password").value = "";
  } catch (e) {
    showAuthError(err, e.message || "Sign up failed. Please try again.");
  } finally {
    setAuthLoading("signup", false);
  }
};

window.handleLogout = async function() {
  closeUserMenu();
  try {
    await signOut();
    allTasks = [];
    currentUser = null;
    showAuthOverlay();
    showToast("👋 Signed out successfully");
  } catch (e) {
    showToast("❌ Logout failed");
  }
};

function showApp() {
  document.getElementById("auth-overlay").classList.add("hidden");
  document.getElementById("app-wrapper").classList.remove("hidden");
  if (currentUser) {
    const initials = (currentUser.email || "U")[0].toUpperCase();
    document.getElementById("user-avatar-initials").textContent = initials;
    document.getElementById("user-email-display").textContent = currentUser.email || "";
  }
}

function showAuthOverlay() {
  document.getElementById("auth-overlay").classList.remove("hidden");
  document.getElementById("app-wrapper").classList.add("hidden");
  clearAuthErrors();
}

function setAuthLoading(type, loading) {
  const btn     = document.getElementById(`${type}-btn`);
  const txt     = document.getElementById(`${type}-btn-text`);
  const spinner = document.getElementById(`${type}-spinner`);
  btn.disabled  = loading;
  txt.style.opacity = loading ? "0" : "1";
  spinner.classList.toggle("hidden", !loading);
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearAuthErrors() {
  ["login-error", "signup-error", "signup-success"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}


// ═══════════════════════════════════════════════════════════
// USER MENU
// ═══════════════════════════════════════════════════════════

window.toggleUserMenu = function() {
  const dd  = document.getElementById("user-dropdown");
  const btn = document.getElementById("user-avatar-btn");
  const open = !dd.classList.contains("hidden");
  dd.classList.toggle("hidden", open);
  btn.setAttribute("aria-expanded", String(!open));
};

function closeUserMenu() {
  document.getElementById("user-dropdown").classList.add("hidden");
  document.getElementById("user-avatar-btn").setAttribute("aria-expanded", "false");
}


// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════

window.toggleTheme = function() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("tf-theme", next);
};

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("theme-icon").textContent = theme === "dark" ? "🌙" : "☀️";
}


// ═══════════════════════════════════════════════════════════
// TASKS – LOAD / ADD / TOGGLE / EDIT / DELETE
// ═══════════════════════════════════════════════════════════

async function loadTasks() {
  showLoading(true);
  try {
    allTasks = await sbFetch(currentUser?.id || null);
    renderTasks();
  } catch (err) {
    console.error("loadTasks:", err);
    showToast("⚠️ Could not load tasks");
  } finally {
    showLoading(false);
  }
}

window.addTask = async function() {
  const input    = document.getElementById("taskInput");
  const title    = input.value.trim();
  const priority = getSelectedPriority();
  const dueDate  = document.getElementById("dueDateInput").value || null;

  if (!title) {
    input.style.animation = "none";
    void input.offsetHeight;
    input.style.animation = "shake .4s ease";
    setTimeout(() => { input.style.animation = ""; }, 400);
    showToast("✏️ Please enter a task title");
    return;
  }

  if (!currentUser) {
    showToast("⚠️ You must be logged in to add tasks");
    return;
  }

  // Optimistic add
  const tempId = "tmp-" + Date.now();
  const optimistic = {
    id: tempId, title, task: title,
    priority, due_date: dueDate,
    completed: false,
    created_at: new Date().toLocaleDateString("en-US", { month:"short",day:"numeric",year:"numeric" }),
  };
  allTasks.unshift(optimistic);
  input.value = "";
  document.getElementById("dueDateInput").value = "";
  resetPriorityPills();
  renderTasks();

  try {
    const saved = await sbAdd({
      title,
      priority,
      dueDate,
      userId: currentUser.id,   // always pass the real user id
    });
    // Replace temp with real row from DB
    const idx = allTasks.findIndex(t => t.id === tempId);
    if (idx !== -1) allTasks[idx] = saved;
    renderTasks();
    showToast("✅ Task added!");
  } catch (err) {
    console.error("addTask:", err);
    allTasks = allTasks.filter(t => t.id !== tempId);
    renderTasks();
    showToast("❌ Failed to add task: " + (err.message || "Unknown error"));
  }
};

window.toggleTask = async function(id) {
  const idx = allTasks.findIndex(t => t.id === id);
  if (idx === -1) return;

  const newCompleted = !allTasks[idx].completed;
  allTasks[idx].completed = newCompleted; // Optimistic
  renderTasks();
  showToast(newCompleted ? "🎉 Task completed!" : "↩️ Marked as active");

  try {
    const updated = await sbToggle(id, newCompleted);
    const i = allTasks.findIndex(t => t.id === id);
    if (i !== -1) allTasks[i] = { ...allTasks[i], ...updated };
    renderTasks();
  } catch (err) {
    console.error("toggleTask:", err);
    // Revert
    allTasks[idx].completed = !newCompleted;
    renderTasks();
    showToast("❌ Failed to update task");
  }
};

window.startEdit = function(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;

  const titleEl = document.getElementById("title-" + id);
  const actionsEl = document.getElementById("actions-" + id);
  if (!titleEl || !actionsEl) return;

  // Replace title span with input
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = task.title;
  input.setAttribute("aria-label", "Edit task title");
  input.id = "edit-input-" + id;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // Replace edit button with save + cancel
  actionsEl.innerHTML = `
    <button class="action-btn save-btn" onclick="saveEdit(${id})" title="Save" aria-label="Save edit">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="action-btn cancel-btn" onclick="cancelEdit(${id})" title="Cancel" aria-label="Cancel edit">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  // Keyboard shortcuts in edit
  input.addEventListener("keydown", e => {
    if (e.key === "Enter")  saveEdit(id);
    if (e.key === "Escape") cancelEdit(id);
  });
};

window.saveEdit = async function(id) {
  const input = document.getElementById("edit-input-" + id);
  if (!input) return;
  const newTitle = input.value.trim();
  if (!newTitle) { showToast("✏️ Title can't be empty"); return; }

  // Optimistic update in local state
  const idx = allTasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    allTasks[idx].title = newTitle;
    allTasks[idx].task  = newTitle;
  }
  renderTasks();

  try {
    // DB column is "task", not "title" — must use the correct column name
    const updated = await sbUpdate(id, { task: newTitle });
    const i = allTasks.findIndex(t => t.id === id);
    if (i !== -1) allTasks[i] = { ...allTasks[i], ...updated };
    renderTasks();
    showToast("✏️ Task updated!");
  } catch (err) {
    console.error("saveEdit:", err);
    showToast("❌ Failed to update task: " + (err.message || "Unknown error"));
    // Revert on failure
    await loadTasks();
  }
};

window.cancelEdit = function(id) {
  renderTasks(); // Just re-render to restore original view
};

window.confirmDelete = function(id) {
  pendingDeleteId = id;
  document.getElementById("confirm-overlay").classList.remove("hidden");
};

window.closeConfirm = function() {
  pendingDeleteId = null;
  document.getElementById("confirm-overlay").classList.add("hidden");
};

async function executeDelete(id) {
  console.log("[delete] starting for id:", id);
  const card = document.getElementById("task-" + id);
  if (card) card.classList.add("removing");

  setTimeout(async () => {
    try {
      await sbDelete(id);
      allTasks = allTasks.filter(t => t.id !== id);
      renderTasks();
      showToast("🗑️ Task deleted");
      console.log("[delete] success for id:", id);
    } catch (err) {
      console.error("[delete] failed for id:", id, err.message);
      // Undo animation so card reappears
      const c = document.getElementById("task-" + id);
      if (c) c.classList.remove("removing");
      showToast("❌ " + (err.message || "Failed to delete task"));
    }
  }, 280);
}


// ═══════════════════════════════════════════════════════════
// FILTER + SEARCH
// ═══════════════════════════════════════════════════════════

window.filterTasks = function(filter) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  const activeTab = document.getElementById("tab-" + filter);
  activeTab.classList.add("active");
  activeTab.setAttribute("aria-selected", "true");
  renderTasks();
};

window.handleSearch = function() {
  searchQuery = document.getElementById("searchInput").value.toLowerCase().trim();
  renderTasks();
};


// ═══════════════════════════════════════════════════════════
// FOCUS MODE
// ═══════════════════════════════════════════════════════════

window.toggleFocusMode = function() {
  isFocusMode = !isFocusMode;
  document.body.classList.toggle("focus-mode", isFocusMode);

  const btn    = document.getElementById("focus-btn");
  const banner = document.getElementById("focus-banner");
  btn.classList.toggle("active", isFocusMode);
  btn.setAttribute("aria-pressed", String(isFocusMode));
  banner.classList.toggle("hidden", !isFocusMode);

  if (isFocusMode) {
    currentFilter = "active";
    showToast("🎯 Focus Mode ON – stay locked in!");
  } else {
    currentFilter = "all";
    filterTasks("all");
    showToast("👋 Focus Mode OFF");
  }
  renderTasks();
};


// ═══════════════════════════════════════════════════════════
// PRIORITY PILLS
// ═══════════════════════════════════════════════════════════

window.selectPriority = function(p) {
  document.querySelectorAll(".priority-pill").forEach(el => {
    el.classList.remove("active");
    el.setAttribute("aria-checked", "false");
  });
  const pill = document.getElementById("pill-" + p);
  if (pill) {
    pill.classList.add("active");
    pill.setAttribute("aria-checked", "true");
  }
};

function getSelectedPriority() {
  const active = document.querySelector(".priority-pill.active");
  return active ? active.id.replace("pill-", "") : "medium";
}

function resetPriorityPills() {
  selectPriority("medium");
}


// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════

function renderTasks() {
  const container = document.getElementById("taskList");
  const emptyEl   = document.getElementById("empty-state");
  const emptyMsg  = document.getElementById("empty-msg");
  const progSec   = document.getElementById("progress-section");

  const total = allTasks.length;
  const done  = allTasks.filter(t => t.completed).length;

  // Header stats
  document.getElementById("total-count").textContent = `${total} task${total !== 1 ? "s" : ""}`;
  document.getElementById("done-count").textContent  = `${done} done`;

  // Progress bar
  if (total > 0) {
    const pct = Math.round((done / total) * 100);
    document.getElementById("progress-bar").style.width  = pct + "%";
    document.getElementById("progress-pct").textContent  = pct + "%";
    document.getElementById("progress-summary").textContent =
      `${done} of ${total} task${total !== 1 ? "s" : ""} done`;
    document.getElementById("progress-message").textContent = getMotivationalMsg(pct);
    document.getElementById("progress-aria").setAttribute("aria-valuenow", pct);
    progSec.classList.remove("hidden");
  } else {
    progSec.classList.add("hidden");
  }

  // Apply filter
  let visible = [...allTasks];
  if (currentFilter === "active")    visible = visible.filter(t => !t.completed);
  if (currentFilter === "completed") visible = visible.filter(t => t.completed);

  // Apply search
  if (searchQuery) {
    visible = visible.filter(t =>
      t.title.toLowerCase().includes(searchQuery)
    );
  }

  // Empty state
  if (visible.length === 0) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    if (total === 0) {
      emptyMsg.textContent = "Start small. One task is enough 🚀";
    } else if (searchQuery) {
      emptyMsg.textContent = `No tasks match "${searchQuery}" 🔍`;
    } else if (currentFilter === "active") {
      emptyMsg.textContent = "All caught up — you're on fire! 🔥";
    } else {
      emptyMsg.textContent = "No completed tasks yet. Keep pushing!";
    }
    return;
  }

  emptyEl.classList.add("hidden");

  container.innerHTML = visible.map(task => buildTaskCard(task)).join("");
}

function buildTaskCard(task) {
  const isOverdue = isTaskOverdue(task);

  return `
    <div class="task-card ${task.completed ? "completed" : ""} ${isOverdue && !task.completed ? "overdue" : ""}"
         id="task-${task.id}"
         data-priority="${task.priority || "medium"}"
         role="listitem">

      <div class="checkbox-wrap" onclick="toggleTask(${typeof task.id === 'string' ? `'${task.id}'` : task.id})" title="${task.completed ? "Mark active" : "Mark complete"}" role="checkbox" aria-checked="${task.completed}" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')toggleTask(${typeof task.id === 'string' ? `'${task.id}'` : task.id})">
        <div class="checkbox ${task.completed ? "checked" : ""}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <div class="task-body">
        <div class="task-top-row">
          <span class="task-title ${task.completed ? "done" : ""}"
                id="title-${task.id}">${escapeHtml(task.title)}</span>
          <span class="priority-badge p-${task.priority || "medium"}">${task.priority || "medium"}</span>
        </div>
        <div class="task-bottom-row">
          <span class="task-date">${task.created_at}</span>
          ${buildDueBadge(task)}
        </div>
      </div>

      <div class="task-actions" id="actions-${task.id}">
        <button class="action-btn edit-btn"
                onclick="startEdit(${typeof task.id === 'string' ? `'${task.id}'` : task.id})"
                title="Edit task" aria-label="Edit task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="action-btn delete-btn"
                onclick="confirmDelete(${typeof task.id === 'string' ? `'${task.id}'` : task.id})"
                title="Delete task" aria-label="Delete task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"></path>
          </svg>
        </button>
      </div>
    </div>`;
}

function buildDueBadge(task) {
  if (!task.due_date) return "";
  const due  = new Date(task.due_date);
  const now  = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff  = Math.round((dueDay - today) / 86400000);

  let cls = "due-later", label = "";
  if (diff < 0)      { cls = "overdue";   label = "Overdue"; }
  else if (diff === 0) { cls = "due-today"; label = "Due today"; }
  else if (diff <= 2)  { cls = "due-soon";  label = `Due in ${diff}d`; }
  else { label = due.toLocaleDateString("en-US", { month:"short", day:"numeric" }); }

  return `<span class="due-badge ${cls}" title="${due.toLocaleDateString()}">📅 ${label}</span>`;
}

function isTaskOverdue(task) {
  if (!task.due_date) return false;
  const now  = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(new Date(task.due_date).setHours(0,0,0,0));
  return dueDay < today;
}


// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function showLoading(show) {
  document.getElementById("loading-state").classList.toggle("hidden", !show);
  document.getElementById("taskList").classList.toggle("hidden", show);
  if (show) {
    document.getElementById("empty-state").classList.add("hidden");
    document.getElementById("progress-section").classList.add("hidden");
  }
}

function getMotivationalMsg(pct) {
  if (pct === 0)   return "Let's start 🚀";
  if (pct < 25)    return "Great start, keep going! 💪";
  if (pct < 50)    return "You're warming up 🔥";
  if (pct === 50)  return "Halfway there, push it! ⚡";
  if (pct < 75)    return "More than halfway done! 🎯";
  if (pct < 100)   return "Almost there, don't stop! 🏁";
  return "You crushed it! 💯";
}

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
  }, 2800);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
