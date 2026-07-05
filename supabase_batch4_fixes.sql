-- ============================================================
-- BATCH 4 FIXES — Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Push Token support (for server-side push notifications)
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ============================================================
-- 2. Referral System
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by TEXT; -- stores referral_code of referrer
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT false;

-- Backfill referral_code for all existing users (first 8 chars of their UUID)
UPDATE public.users
SET referral_code = UPPER(SUBSTR(id::TEXT, 1, 8))
WHERE referral_code IS NULL;

-- Ensure new users get a referral_code auto-generated
-- (The app will set this on sign-up, but this trigger is a safety net)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTR(NEW.id::TEXT, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON public.users;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- ============================================================
-- 3. Index for fast referral lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_push_token ON public.users (push_token) WHERE push_token IS NOT NULL;
