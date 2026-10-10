-- Core schema: profiles, saved_foods, saved_meals, diary_entries.
-- Every table is owned by a user (user_id) and protected by RLS (see next migration).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Utilizador',
  mode text not null default 'maintain' check (mode in ('cut', 'maintain', 'bulk')),
  goal_calories integer not null default 2000 check (goal_calories > 0),
  goal_protein integer not null default 150 check (goal_protein >= 0),
  goal_carbs integer not null default 200 check (goal_carbs >= 0),
  goal_fat integer not null default 65 check (goal_fat >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- saved_foods (values per 100 g) --------------------------------------------
create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  off_code text,
  calories_100g integer not null check (calories_100g >= 0),
  protein_100g numeric(8, 1) not null check (protein_100g >= 0),
  carbs_100g numeric(8, 1) not null check (carbs_100g >= 0),
  fat_100g numeric(8, 1) not null check (fat_100g >= 0),
  times_used integer not null default 0 check (times_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index saved_foods_user_name_key
  on public.saved_foods (user_id, lower(trim(name)));

create trigger saved_foods_set_updated_at
  before update on public.saved_foods
  for each row execute function public.set_updated_at();

-- saved_meals ---------------------------------------------------------------
-- items: [{ name, quantity_g, calories, protein_g, carbs_g, fat_g }]
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total_calories integer not null check (total_calories >= 0),
  total_protein numeric(8, 1) not null check (total_protein >= 0),
  total_carbs numeric(8, 1) not null check (total_carbs >= 0),
  total_fat numeric(8, 1) not null check (total_fat >= 0),
  times_used integer not null default 0 check (times_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index saved_meals_user_name_key
  on public.saved_meals (user_id, lower(trim(name)));

create trigger saved_meals_set_updated_at
  before update on public.saved_meals
  for each row execute function public.set_updated_at();

-- diary_entries -------------------------------------------------------------
-- Composite FKs (user_id, saved_*_id) guarantee an entry can only reference
-- saved items owned by the same user.
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  kind text not null check (kind in ('food', 'meal')),
  name text not null check (length(trim(name)) > 0),
  quantity_g numeric(8, 1) check (quantity_g > 0),
  calories integer not null check (calories >= 0),
  protein_g numeric(8, 1) not null check (protein_g >= 0),
  carbs_g numeric(8, 1) not null check (carbs_g >= 0),
  fat_g numeric(8, 1) not null check (fat_g >= 0),
  items jsonb check (jsonb_typeof(items) = 'array'),
  saved_food_id uuid,
  saved_meal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'meal' or items is not null),
  check (kind <> 'food' or saved_meal_id is null),
  check (kind <> 'meal' or saved_food_id is null),
  foreign key (user_id, saved_food_id)
    references public.saved_foods (user_id, id) on delete set null (saved_food_id),
  foreign key (user_id, saved_meal_id)
    references public.saved_meals (user_id, id) on delete set null (saved_meal_id)
);

create index diary_entries_user_date_idx on public.diary_entries (user_id, entry_date);
create index diary_entries_saved_food_idx on public.diary_entries (user_id, saved_food_id)
  where saved_food_id is not null;
create index diary_entries_saved_meal_idx on public.diary_entries (user_id, saved_meal_id)
  where saved_meal_id is not null;

create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();
