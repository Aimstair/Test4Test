-- Add DELETE policy for reports to allow admins to dismiss/delete them
CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
