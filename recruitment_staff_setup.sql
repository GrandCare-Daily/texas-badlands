-- Texas Badlands Recruitment HQ: staff role lookup.
-- Run this only AFTER the original six-table Recruiting Setup completed successfully.
-- Does not grant owner privileges to any account automatically.
--
-- Supabase Dashboard -> SQL Editor -> New query -> Run

BEGIN;

CREATE OR REPLACE FUNCTION public.tb_my_staff_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.role
  FROM recruitment_private.tb_staff AS s
  WHERE s.user_id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.tb_my_staff_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_my_staff_role() TO authenticated;

-- Server-side authorization for contest start/finish: OWNER ONLY.
CREATE OR REPLACE FUNCTION recruitment_private.tb_is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $
  SELECT EXISTS (
    SELECT 1
    FROM recruitment_private.tb_staff AS s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.role = 'owner'
  )
$;

REVOKE ALL ON FUNCTION recruitment_private.tb_is_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION recruitment_private.tb_is_owner() TO authenticated;

DROP POLICY IF EXISTS tb_contests_staff_update ON public.tb_contests;
DROP POLICY IF EXISTS tb_contests_owner_update ON public.tb_contests;

CREATE POLICY tb_contests_owner_update
ON public.tb_contests
FOR UPDATE TO authenticated
USING ((SELECT recruitment_private.tb_is_owner()))
WITH CHECK ((SELECT recruitment_private.tb_is_owner()));

COMMIT;

-- OWNER BOOTSTRAP (run separately AFTER registering your own website account):
-- Replace YOUR_EMAIL_HERE with the email address for your website account.
-- Do not run with the placeholder unchanged. Never grant staff access from the browser.
--
-- INSERT INTO recruitment_private.tb_staff (user_id, role)
-- SELECT id, 'owner'
-- FROM auth.users
-- WHERE lower(email) = lower('YOUR_EMAIL_HERE')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
--
-- Check: SELECT s.role, u.email
-- FROM recruitment_private.tb_staff AS s
-- JOIN auth.users AS u ON u.id=s.user_id;
