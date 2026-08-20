-- ============================================================
-- BATCH 5 FIXES — Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Add subscription_locked column to apps
--    true  = listing was created for free via Pro/Pro+ subscription
--            → expires when the owner's subscription expires
--    false = listing was paid with tokens (default)
--            → expires on its own fixed expires_at date
-- ============================================================
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS subscription_locked BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Update process_subscription_expiries to also expire
--    subscription-locked listings when the subscription lapses.
-- ============================================================
CREATE OR REPLACE FUNCTION process_subscription_expiries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_user RECORD;
  expired_app  RECORD;
BEGIN
  FOR expired_user IN
    SELECT id, name, subscription_tier
    FROM public.users
    WHERE subscription_tier != 'Basic'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < NOW()
  LOOP
    -- 1. Expire all subscription-locked app listings for this user
    FOR expired_app IN
      SELECT id, name
      FROM public.apps
      WHERE owner_id = expired_user.id
        AND subscription_locked = true
        AND active = true
    LOOP
      -- Deactivate the listing
      UPDATE public.apps
      SET active = false, expires_at = NOW()
      WHERE id = expired_app.id;

      -- Notify the user per app
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        expired_user.id,
        'Listing Expired',
        '📋 Your listing "' || expired_app.name || '" has been deactivated because your ' || expired_user.subscription_tier || ' subscription expired.',
        'app_expiry'
      );
    END LOOP;

    -- 2. Downgrade user to Basic
    UPDATE public.users
    SET subscription_tier = 'Basic', subscription_expires_at = NULL
    WHERE id = expired_user.id;

    -- 3. Notify user of subscription downgrade
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      expired_user.id,
      'Subscription Expired',
      '⚠️ Your ' || expired_user.subscription_tier || ' subscription has expired. You have been downgraded to Basic.',
      'subscription'
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 3. Reschedule the job (replaces the old definition)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('process_subscription_expiries_job');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
  'process_subscription_expiries_job',
  '0 1 * * *',
  'SELECT process_subscription_expiries()'
);
