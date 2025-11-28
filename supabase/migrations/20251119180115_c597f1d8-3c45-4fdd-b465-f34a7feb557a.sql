-- Allow authenticated users to search for organizations by name
-- This is needed for the join request flow where users need to find organizations before joining
CREATE POLICY "Users can search organizations by name"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);