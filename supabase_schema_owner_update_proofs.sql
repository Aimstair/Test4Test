CREATE POLICY "App owners can update contract days."
  ON public.contract_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.contracts c 
    JOIN public.apps a ON c.app_id = a.id 
    WHERE c.id = contract_id AND a.owner_id = auth.uid()
  ));
