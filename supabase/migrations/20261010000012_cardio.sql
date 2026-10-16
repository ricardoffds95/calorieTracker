-- Cardio and sports: the activities a training can be (reference data, plus the user's own), and the cardio trainings.
-- MET values: Compendium of Physical Activities (2024 Adult), https://pacompendium.com/. Do not change them: the Compendium asks for that.

-- activities -------------------------------------------------------------------------------------------------
-- user_id null = built in (readable by everyone, changed only by a migration); user_id set = the user's own.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  met numeric(4, 1) check (met > 0 and met <= 25), -- null: no estimate of calories
  source text,                                      -- code of the Compendium
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index activities_owner_name_key
  on public.activities (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));

alter table public.activities enable row level security;

create policy "activities_select_builtin_or_own" on public.activities
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "activities_insert_own" on public.activities
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "activities_update_own" on public.activities
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "activities_delete_own" on public.activities
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.activities from anon;
revoke all on public.activities from authenticated;
grant select, insert, update, delete on public.activities to authenticated;

insert into public.activities (name, met, source, sort_order) values
  ('Running', 8.0, '12150', 1),    -- Running
  ('Cycling', 7.0, '01014', 2),    -- Bicycling, general
  ('Football', 7.0, '15610', 3),   -- Soccer, casual, general
  ('Tennis', 6.8, '15675', 4),     -- Tennis, general, moderate effort
  ('Padel', 6.0, '15680', 5),      -- not in the Compendium: tennis, doubles (an approximation)
  ('Volleyball', 4.0, '15710', 6); -- Volleyball

-- training_entries: cardio ------------------------------------------------------------------------------------
-- A cardio training keeps a copy of what it was made from (name, MET, weight), so later changes never rewrite the history.
alter table public.training_entries
  add column kind text not null default 'strength' check (kind in ('strength', 'cardio')),
  add column activity_id uuid references public.activities (id) on delete set null,
  add column duration_min integer check (duration_min between 1 and 1440),
  add column met numeric(4, 1) check (met > 0 and met <= 25),
  add column weight_kg numeric(5, 1) check (weight_kg > 0),
  add column calories_est integer check (calories_est >= 0),
  add column notes text check (char_length(notes) <= 1000);

alter table public.training_entries alter column exercises drop not null;
alter table public.training_entries drop constraint training_entries_exercises_check;
alter table public.training_entries add constraint training_entries_exercises_check
  check (exercises is null or (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 50));
alter table public.training_entries add constraint training_entries_kind_shape_check
  check (
    (kind = 'strength' and exercises is not null and duration_min is null)
    or (kind = 'cardio' and exercises is null and duration_min is not null)
  );

-- An entry can only point at an activity its user can see (built in or their own): RLS hides the others, so the lookup fails.
create or replace function public.check_training_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.activity_id is not null
     and not exists (select 1 from public.activities a where a.id = new.activity_id and (a.user_id is null or a.user_id = new.user_id)) then
    raise exception 'unknown activity' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger training_entries_check_activity
  before insert or update of activity_id on public.training_entries
  for each row execute function public.check_training_activity();
