DROP POLICY IF EXISTS "Managers can update tasks in organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins and owners can update any task" ON public.tasks;
DROP POLICY IF EXISTS "Managers can delete tasks in organization" ON public.tasks;

CREATE POLICY "Admins and owners can update any task"
ON public.tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND is_admin_or_owner(u.id, u.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND is_admin_or_owner(u.id, u.organization_id)
  )
);

CREATE POLICY "Managers can update tasks in department"
ON public.tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u_act
    WHERE u_act.auth_user_id = auth.uid()
      AND has_role(u_act.id, 'manager'::app_role, u_act.organization_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.users u_assignee
          WHERE u_assignee.id = public.tasks.assignee_id
            AND u_assignee.department_id = u_act.department_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.department_id = u_act.department_id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u_act
    WHERE u_act.auth_user_id = auth.uid()
      AND has_role(u_act.id, 'manager'::app_role, u_act.organization_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.users u_assignee
          WHERE u_assignee.id = public.tasks.assignee_id
            AND u_assignee.department_id = u_act.department_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.department_id = u_act.department_id
        )
      )
  )
);

CREATE POLICY "Managers can delete tasks in department"
ON public.tasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u_act
    WHERE u_act.auth_user_id = auth.uid()
      AND has_role(u_act.id, 'manager'::app_role, u_act.organization_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.users u_assignee
          WHERE u_assignee.id = public.tasks.assignee_id
            AND u_assignee.department_id = u_act.department_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.department_id = u_act.department_id
        )
      )
  )
);
