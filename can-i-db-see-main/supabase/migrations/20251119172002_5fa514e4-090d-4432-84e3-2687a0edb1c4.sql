-- Create organization_join_requests table
CREATE TABLE public.organization_join_requests (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITHOUT TIME ZONE,
  reviewed_by INTEGER REFERENCES public.users(id),
  UNIQUE(user_id, organization_id)
);

-- Create indexes for performance
CREATE INDEX idx_org_join_requests_status ON public.organization_join_requests(organization_id, status);
CREATE INDEX idx_org_join_requests_user ON public.organization_join_requests(user_id);

-- Enable RLS
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.organization_join_requests
FOR SELECT
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Users can create join requests
CREATE POLICY "Users can create join requests"
ON public.organization_join_requests
FOR INSERT
WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Admins/owners can view requests for their org
CREATE POLICY "Admins can view org requests"
ON public.organization_join_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.organization_id = organization_join_requests.organization_id
    AND is_admin_or_owner(u.id, u.organization_id)
  )
);

-- Admins/owners can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
ON public.organization_join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.organization_id = organization_join_requests.organization_id
    AND is_admin_or_owner(u.id, u.organization_id)
  )
);