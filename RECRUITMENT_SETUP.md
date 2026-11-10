# Texas Badlands Recruitment HQ — draft integration

This feature is being prepared on the GitHub branch feature/recruitment-supabase.
Do not merge to main or publish to players until the owner has tested and approved it.

## Scope
- The existing static website stays static. Added recruitment.html, recruitment.css, and recruitment.js.
- The existing homepage gets one navigation link on the feature branch.
- Supabase Auth and the six existing tb_ public database tables power the site.
- Publishable Supabase credentials are included in client-side JS, as designed. NEVER use service-role, secret, or database password in client-side code.
- Contest remains draft and user referral confirmations stay disabled until staff activates it.
- Check-ins are player self-reports; verified sessions and leaderboard qualification must be reviewed by authorized staff. No automatic connection to Host Havoc.

## Supabase steps before public launch
1. Confirm the original database setup returned success and the six tb_ tables exist under public schema with row-level security.
2. Run recruitment_staff_setup.sql in Supabase SQL Editor. It defines a safe, read-only RPC for checking whether the logged-in user is a staff member. A missing RPC keeps the staff UI hidden.
3. In Supabase Authentication → URL Configuration, set Site URL to your approved website domain and add https://texas-badlands.vercel.app/recruitment.html as an allowed Redirect URL; also allow any specific Vercel preview domain you use for testing. Test signup and confirmation email. Avoid overly broad wildcards in production.
4. Create your own recruitment account in the website; only AFTER signup, assign the owner's auth user ID into recruitment_private.tb_staff with the separate owner bootstrap SQL in the comment at the bottom of the staff setup file, replacing the placeholder email. Do not put email/password or admin roles in website code.
5. Verify your account sees "Verification Desk", and a normal test account does not. Confirm invitee (not inviter) must acknowledge the referral and that only staff can approve check-ins or verified sessions.
6. Use a legitimate DayZ log / player history to record first-join timestamps and verify sessions. Missing or ambiguous sessions must be manually reviewed before approval.
7. Review before activating. Contest activation sets 30 days from the activation time and can only be initiated by someone recognized by the UI as owner; database RLS separately requires staff membership. The competition is not live until explicitly activated.

## Required functional test
- Fresh user signup, confirmation email, login and logout.
- Player profile created automatically, changing DayZ name updates leaderboard.
- Inviter shares referral code; invitee confirms it (after contest activation).
- Self-referrals and duplicate claims rejected by database constraints/policies.
- Invitee submits check-in, staff approves, trigger generates verified session.
- Verified minutes, distinct days, and status update after staff approval.
- Overlapping sessions rejected, and no non-staff account can modify verified counts.
- Leaderboard counts only referrals marked qualified.
- Verify mobile layout and browser console errors.

## Limitations
- A staff reviewer must validate DayZ player identity and sessions; there is no Host Havoc log importer in this version.
- Displayed DayZ names and UUIDs are covered by the existing database tb_players SELECT policy from the original SQL setup. If more privacy is required, update the database exposure and use a dedicated safe public view before opening registration.
- The private admin UI is hidden unless tb_my_staff_role() confirms a staff role. Backend RLS remains the real authorization boundary.
