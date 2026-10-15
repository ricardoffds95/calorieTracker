-- Training: workouts the user keeps, and the trainings done on a day.
-- exercises: [{ "id": "<free-exercise-db id>", "name": "<name when it was added>" }]. The exercises themselves (muscles,
-- steps, photos) are a static file of the app, not rows.

-- saved_workouts -------------------------------------------------------------
create table public.saved_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 50),
  times_used integer not null default 0 check (times_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index saved_workouts_user_name_key
  on public.saved_workouts (user_id, lower(trim(name)));

create trigger saved_workouts_set_updated_at
  before update on public.saved_workouts
  for each row execute function public.set_updated_at();

-- training_entries -----------------------------------------------------------
-- The composite FK guarantees an entry can only point at a workout of the same user.
create table public.training_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  name text not null check (length(trim(name)) between 1 and 100),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 50),
  saved_workout_id uuid,
  created_at timestamptz not null default now(),
  foreign key (user_id, saved_workout_id)
    references public.saved_workouts (user_id, id) on delete set null (saved_workout_id)
);

create index training_entries_user_date_idx on public.training_entries (user_id, entry_date);
create index training_entries_saved_workout_idx on public.training_entries (user_id, saved_workout_id)
  where saved_workout_id is not null;

-- times_used = number of trainings currently linked (counted in SQL, like the saved meals) ---
create or replace function public.track_workout_usage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.saved_workout_id is not null and (tg_op = 'DELETE' or new.saved_workout_id is distinct from old.saved_workout_id) then
      update public.saved_workouts set times_used = greatest(times_used - 1, 0) where id = old.saved_workout_id;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.saved_workout_id is not null and (tg_op = 'INSERT' or new.saved_workout_id is distinct from old.saved_workout_id) then
      update public.saved_workouts set times_used = times_used + 1 where id = new.saved_workout_id;
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger training_entries_track_workout_usage
  after insert or delete or update of saved_workout_id on public.training_entries
  for each row execute function public.track_workout_usage();

-- RLS: each user only reaches their own rows --------------------------------------------
alter table public.saved_workouts enable row level security;
alter table public.training_entries enable row level security;

create policy "saved_workouts_select_own" on public.saved_workouts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_workouts_insert_own" on public.saved_workouts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_workouts_update_own" on public.saved_workouts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "saved_workouts_delete_own" on public.saved_workouts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "training_entries_select_own" on public.training_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "training_entries_insert_own" on public.training_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "training_entries_update_own" on public.training_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "training_entries_delete_own" on public.training_entries
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.saved_workouts, public.training_entries from anon;
revoke all on public.saved_workouts, public.training_entries from authenticated;
grant select, insert, update, delete on public.saved_workouts, public.training_entries to authenticated;
