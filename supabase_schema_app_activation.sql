-- Add active column to apps table to control listing/delisting
ALTER TABLE public.apps ADD COLUMN active BOOLEAN DEFAULT true;
