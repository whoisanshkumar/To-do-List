-- ================================================================
-- Taskflow – Supabase RLS Policies
-- Run this in: Supabase Dashboard > SQL Editor
-- ================================================================

-- Step 1: Enable RLS on the tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Step 2: DROP any existing conflicting policies (safe to re-run)
DROP POLICY IF EXISTS "Users can view their own tasks"   ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Step 3: SELECT – each user sees only their own tasks
CREATE POLICY "Users can view their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

-- Step 4: INSERT – users can only insert rows with their own user_id
CREATE POLICY "Users can insert their own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 5: UPDATE – users can only update their own rows
CREATE POLICY "Users can update their own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- Step 6: DELETE – users can only delete their own rows
CREATE POLICY "Users can delete their own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- VERIFICATION: Run this after the above to confirm policies exist
-- ================================================================
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tasks';
