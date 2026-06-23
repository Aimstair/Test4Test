-- ==========================================
-- Test4Test Backend Notification Triggers
-- ==========================================

-- Function to notify all users when a high-value app is published or boosted
CREATE OR REPLACE FUNCTION notify_all_on_boost()
RETURNS TRIGGER AS $$
BEGIN
    -- Scenario 1: App is Boosted (UPDATE)
    IF (TG_OP = 'UPDATE' AND NEW.boost_ends_at > now() AND (OLD.boost_ends_at IS NULL OR OLD.boost_ends_at < now())) THEN
        INSERT INTO public.notifications (user_id, title, body, type, is_read)
        SELECT id, '🔥 Hot Opportunity', NEW.name || ' is looking for testers! Claim your spot now for ' || (NEW.bounty + 10) || ' tokens.', 'subscription', false
        FROM public.users
        WHERE id != NEW.owner_id;
    END IF;

    -- Scenario 2: New Pro+ App is Listed (INSERT)
    IF (TG_OP = 'INSERT' AND NEW.tier = 'Pro+' AND NEW.active = true) THEN
        INSERT INTO public.notifications (user_id, title, body, type, is_read)
        SELECT id, '⭐ Premium App Alert', NEW.name || ' is looking for testers! Claim your spot now for ' || NEW.bounty || ' tokens.', 'subscription', false
        FROM public.users
        WHERE id != NEW.owner_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to avoid duplication
DROP TRIGGER IF EXISTS trigger_notify_all_on_boost ON public.apps;

-- Create the trigger on the apps table
CREATE TRIGGER trigger_notify_all_on_boost
AFTER INSERT OR UPDATE ON public.apps
FOR EACH ROW
EXECUTE FUNCTION notify_all_on_boost();
