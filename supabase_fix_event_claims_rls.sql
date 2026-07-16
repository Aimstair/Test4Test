-- Fix event_claims RLS to allow admins to view all claims
CREATE POLICY "Enable read access for admins on event_claims" ON public.event_claims
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
