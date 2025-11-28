DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Owners can manage roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'owner'::app_role, user_roles.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'owner'::app_role, user_roles.organization_id)
  )
);
CREATE POLICY "Admins manage roles except owner"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'admin'::app_role, user_roles.organization_id)
  )
  AND user_roles.role <> 'owner'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'admin'::app_role, user_roles.organization_id)
  )
  AND user_roles.role <> 'owner'
);
CREATE POLICY "Managers manage roles except owner"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'manager'::app_role, user_roles.organization_id)
  )
  AND user_roles.role <> 'owner'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'manager'::app_role, user_roles.organization_id)
  )
  AND user_roles.role <> 'owner'
);
CREATE POLICY "Admins can update users except owners"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'admin'::app_role, users.organization_id)
  )
  AND users.role <> 'owner'
)
WITH CHECK (
  users.role <> 'owner'
);
CREATE POLICY "Managers can update users except owners"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'manager'::app_role, users.organization_id)
  )
  AND users.role <> 'owner'
)
WITH CHECK (
  users.role <> 'owner'
);
CREATE POLICY "Admins can delete users except owners"
ON public.users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'admin'::app_role, users.organization_id)
  )
  AND users.role <> 'owner'
);
CREATE POLICY "Managers can delete users except owners"
ON public.users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND has_role(u.id, 'manager'::app_role, users.organization_id)
  )
  AND users.role <> 'owner'
);
CREATE POLICY "Managers can update tasks in organization"
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
            AND u_assignee.organization_id = u_act.organization_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.organization_id = u_act.organization_id
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
            AND u_assignee.organization_id = u_act.organization_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.organization_id = u_act.organization_id
        )
      )
  )
);
CREATE POLICY "Managers can delete tasks in organization"
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
            AND u_assignee.organization_id = u_act.organization_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.organization_id = u_act.organization_id
        )
      )
  )
);
CREATE POLICY "Admins and owners can delete tasks"
ON public.tasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND is_admin_or_owner(u.id, u.organization_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.users u_assignee
          WHERE u_assignee.id = public.tasks.assignee_id
            AND u_assignee.organization_id = u.organization_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u_manager
          WHERE u_manager.id = public.tasks.manager_id
            AND u_manager.organization_id = u.organization_id
        )
      )
  )
);
CREATE POLICY "Managers can create tasks in organization"
ON public.tasks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u_act
    WHERE u_act.auth_user_id = auth.uid()
      AND has_role(u_act.id, 'manager'::app_role, u_act.organization_id)
  )
  AND (
    public.tasks.assignee_id IN (
      SELECT id FROM public.users WHERE organization_id = (
        SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()
      )
    )
    OR public.tasks.manager_id IN (
      SELECT id FROM public.users WHERE organization_id = (
        SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()
      )
    )
  )
);