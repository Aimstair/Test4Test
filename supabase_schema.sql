-- Test4Test Supabase SQL Migration Script
-- Run this script in the Supabase SQL Editor

-- 1. Create Users Table
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  karma FLOAT DEFAULT 80,
  tokens INTEGER DEFAULT 0,
  escrow INTEGER DEFAULT 0,
  device TEXT,
  os TEXT,
  country TEXT,
  onboarded BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'Basic',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  notification_prefs JSONB DEFAULT '{"new_tester":true,"new_review":true,"app_expiry":true,"app_full":true,"daily_reports":true,"subscription":true,"new_proof":true,"check_in":true,"testing_finished":true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles."
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create user on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Create Apps Table
CREATE TABLE public.apps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.users NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  blurb TEXT,
  internal_test_url TEXT,
  package_name TEXT UNIQUE,
  bounty INTEGER NOT NULL,
  tier TEXT NOT NULL,
  tester_limit INTEGER NOT NULL,
  geo_targets JSONB,
  os_requirements JSONB,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apps are viewable by everyone."
  ON public.apps FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own apps."
  ON public.apps FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own apps."
  ON public.apps FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own apps."
  ON public.apps FOR DELETE
  USING (auth.uid() = owner_id);


-- 3. Create Contracts Table
CREATE TABLE public.contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  app_id UUID REFERENCES public.apps NOT NULL,
  tester_id UUID REFERENCES public.users NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts or contracts for their apps."
  ON public.contracts FOR SELECT
  USING (auth.uid() = tester_id OR auth.uid() IN (SELECT owner_id FROM public.apps WHERE id = app_id));

CREATE POLICY "Users can create contracts."
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() = tester_id);


-- 4. Create Contract Days Table
CREATE TABLE public.contract_days (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts NOT NULL,
  day_number INTEGER NOT NULL,
  status TEXT DEFAULT 'future' NOT NULL,
  proof_image_url TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contract_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their contract days."
  ON public.contract_days FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.tester_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.contracts c JOIN public.apps a ON c.app_id = a.id WHERE c.id = contract_id AND a.owner_id = auth.uid())
  );

CREATE POLICY "Testers can update their contract days."
  ON public.contract_days FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.tester_id = auth.uid()));


-- 5. Create Transactions Table
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount FLOAT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions."
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions."
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- 6. Create Notifications Table
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications."
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications."
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications."
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Missing policies for contract_days INSERT (needed when creating contracts)
CREATE POLICY "Testers can insert their contract days."
  ON public.contract_days FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.tester_id = auth.uid()));

-- 8. Allow testers to update their own contracts (for forfeit)
CREATE POLICY "Testers can update their own contracts."
  ON public.contracts FOR UPDATE
  USING (auth.uid() = tester_id);

-- Storage bucket for app icons and proofs
-- Note: You'll need to create a bucket named 'public-assets' via the Supabase Dashboard
-- Alternatively, if running this via SQL editor as superuser:
INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'public-assets');
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'public-assets' AND auth.role() = 'authenticated');

-- 9. Create Reviews Table
CREATE TABLE public.reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  app_id UUID REFERENCES public.apps NOT NULL,
  reviewer_id UUID REFERENCES public.users NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews viewable by everyone."
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Testers can insert reviews."
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- 10. Create Reports Table
CREATE TABLE public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  app_id UUID REFERENCES public.apps NOT NULL,
  reporter_id UUID REFERENCES public.users,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports viewable by everyone."
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "Users can insert reports."
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);


-- 11. Create Support Tickets Table
CREATE TABLE public.support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets or admins can view all."
  ON public.support_tickets FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can insert tickets."
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update tickets."
  ON public.support_tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 12. Create Ticket Replies Table
CREATE TABLE public.ticket_replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES public.support_tickets NOT NULL,
  sender_id UUID REFERENCES public.users NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view replies to their tickets or admins can view all."
  ON public.ticket_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users or admins can reply to tickets."
  ON public.ticket_replies FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

