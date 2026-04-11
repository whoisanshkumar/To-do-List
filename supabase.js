/* ============================================================
   supabase.js  –  Taskflow × Supabase Integration
   ============================================================
   Table schema (tasks):
     id          int8  PK autoincrement
     task        text
     created_at  timestamp  default now()

   RLS: DISABLED  →  anon key can read/write freely
   ============================================================ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ── Supabase client ─────────────────────────────────────────
const SUPABASE_URL  = "https://hvloalslkihbsbfipsmb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bG9hbHNsa2loYnNiZmlwc21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDk1MjAsImV4cCI6MjA5MTQ4NTUyMH0.Ia6Zc2GFQJDXERzBx5HfFBH4MjQInEA9qrNZYZSjZYw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


// ── Fetch all tasks (newest first) ──────────────────────────
export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("fetchTasks error:", error.message);
    return [];
  }

  // Normalise to the shape the UI expects
  return data.map(normalise);
}


// ── Add a new task ──────────────────────────────────────────
export async function addTask(title) {
  const { data, error } = await supabase
    .from("tasks")
    .insert([{ task: title }])
    .select()
    .single();

  if (error) {
    console.log("addTask error:", error.message);
    return null;
  }

  return normalise(data);
}


// ── Delete a task ───────────────────────────────────────────
export async function deleteTask(id) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.log("deleteTask error:", error.message);
    return false;
  }

  return true;
}


// ── Helper: map DB row → UI object ──────────────────────────
// The DB only stores id / task / created_at.
// We add UI-only fields so the rest of app.js works unchanged.
function normalise(row) {
  return {
    id:          row.id,
    title:       row.task,           // UI uses "title"
    task:        row.task,
    created_at:  formatTimestamp(row.created_at),
    completed:   false,              // no completed column → default false
    priority:    "medium",           // no priority column → default medium
    due_date:    null,               // no due_date column → none
  };
}


// ── Helper: pretty-print ISO timestamp ──────────────────────
function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
