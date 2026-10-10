-- The questionnaire asks about training differently: aerobic and anaerobic sessions per week, their intensity and
-- free notes. activity_sessions_per_week and exercise_types (first version, answers from a few hours only) are no
-- longer read or written by the app; they are left in place and can be dropped in a later cleanup migration.

alter table public.profiles
  add column daily_activity text check (daily_activity in ('sedentary', 'light', 'active', 'very_active')),
  add column aerobic_sessions_per_week integer check (aerobic_sessions_per_week between 0 and 14),
  add column anaerobic_sessions_per_week integer check (anaerobic_sessions_per_week between 0 and 14),
  add column training_intensity text check (training_intensity in ('low', 'moderate', 'high')),
  add column training_notes text check (char_length(training_notes) <= 2000),
  -- the calculated plan for each goal ({cut, maintain, bulk}, each with calories and macros), kept so the goal can
  -- change later without redoing the questionnaire
  add column saved_plans jsonb;
