-- Onboarding questionnaire: what the user told us about themselves, the AI's explanation of the plan, and
-- when the questionnaire was finished (or skipped). New accounts have onboarding_done_at = null and see the
-- questionnaire on the first login; accounts that already exist are marked as done so they do not.
-- The goals themselves stay in goal_calories / goal_protein / goal_carbs / goal_fat.

alter table public.profiles
  add column sex text check (sex in ('male', 'female')),
  add column age integer check (age between 14 and 100),
  add column height_cm integer check (height_cm between 100 and 250),
  add column weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  add column body_fat_pct numeric(4, 1) check (body_fat_pct between 3 and 60),
  add column activity_sessions_per_week integer check (activity_sessions_per_week between 0 and 14),
  add column exercise_types text[] not null default '{}',
  add column plan_summary text,
  add column onboarding_done_at timestamptz;

update public.profiles set onboarding_done_at = now() where onboarding_done_at is null;
