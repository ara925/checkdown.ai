-- Step 1: Add manager role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';

-- Step 2: Add review_comment field to tasks for rejection reasons
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- Step 3: Create task_links table for multiple links per task
CREATE TABLE IF NOT EXISTS task_links (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Enable RLS on task_links
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;

-- Users can view task links for tasks they can access
CREATE POLICY "Users can view task links for accessible tasks"
ON task_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
    WHERE t.id = task_links.task_id
    AND (
      t.assignee_id = u.id 
      OR t.manager_id = u.id 
      OR EXISTS (
        SELECT 1 FROM users u2 
        WHERE u2.id = t.assignee_id 
        AND u2.organization_id = u.organization_id
      )
    )
  )
);

-- Users can add links to tasks they can access
CREATE POLICY "Users can add task links for accessible tasks"
ON task_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
    WHERE t.id = task_links.task_id
    AND (
      t.assignee_id = u.id 
      OR t.manager_id = u.id 
      OR EXISTS (
        SELECT 1 FROM users u2 
        WHERE u2.id = t.assignee_id 
        AND u2.organization_id = u.organization_id
      )
    )
  )
);

-- Users can delete their own task links or if they're admin/owner
CREATE POLICY "Users can delete task links"
ON task_links
FOR DELETE
USING (
  created_by = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  OR is_admin_or_owner(
    (NULLIF(current_setting('app.user_id', true), ''))::INTEGER,
    (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER
  )
);