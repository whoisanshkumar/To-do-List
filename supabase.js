/* ============================================================
   supabase.js  –  Taskflow × Supabase v3 Integration
   ============================================================
   Table schema (tasks) – EXTENDED:
     id          int8  PK autoincrement
     task        text
     created_at  timestamp  default now()
     completed   boolean    default false
     priority    text       default 'medium'
     due_date    timestamp  nullable
     user_id     uuid       (references auth.users.id)

   RLS: DISABLED  →  anon key can read/write freely
   ============================================================ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ── Supabase client ─────────────────────────────────────────
const SUPABASE_URL  = "https://hvloalslkihbsbfipsmb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bG9hbHNsa2loYnNiZmlwc21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDk1MjAsImV4cCI6MjA5MTQ4NTUyMH0.Ia6Zc2GFQJDXERzBx5HfFBH4MjQInEA9qrNZYZSjZYw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

/** Sign up a new user */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in an existing user */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign out the current user */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get the current session */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get the current user */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Listen to auth state changes */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}


// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════

/** Fetch all tasks for the current user (newest first) */
export async function fetchTasks(userId) {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  // If we have a userId, filter by it; otherwise fall back to public tasks
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchTasks error:", error.message);
    return [];
  }

  return data.map(normalise);
}


/** Add a new task */
export async function addTask({ title, priority = "medium", dueDate = null, userId = null }) {
  const payload = {
    task:      title,
    priority:  priority,
    due_date:  dueDate || null,
    completed: false,
  };

  if (userId) payload.user_id = userId;

  const { data, error } = await supabase
    .from("tasks")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("addTask error:", error.message);
    throw error;
  }

  return normalise(data);
}


/** Toggle the completed state of a task */
export async function toggleTask(id, completed) {
  const { data, error } = await supabase
    .from("tasks")
    .update({ completed })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("toggleTask error:", error.message);
    throw error;
  }

  return normalise(data);
}


/** Update a task's title (and optionally other fields) */
export async function updateTask(id, fields) {
  const { data, error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateTask error:", error.message);
    throw error;
  }

  return normalise(data);
}


/** Delete a task */
export async function deleteTask(id) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteTask error:", error.message);
    throw error;
  }

  return true;
}


// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Map DB row → UI object */
function normalise(row) {
  return {
    id:         row.id,
    title:      row.task,
    task:       row.task,
    created_at: formatTimestamp(row.created_at),
    completed:  row.completed ?? false,
    priority:   row.priority  ?? "medium",
    due_date:   row.due_date  ?? null,
    user_id:    row.user_id   ?? null,
  };
}

/** Pretty-print ISO timestamp */
function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
