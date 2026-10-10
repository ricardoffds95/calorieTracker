-- Log screen: meal doses, usage counters, auto-saving foods and propagating edits of saved items.
-- All functions are SECURITY INVOKER: RLS applies, so a user can only read/update their own rows.

-- doses ---------------------------------------------------------------------
-- How many portions of a saved meal were logged (null for other entries), so an
-- edit of the saved meal can be re-applied with the same multiplier.
alter table public.diary_entries
  add column doses numeric(6, 2) check (doses > 0);

-- times_used = number of diary entries currently linked ----------------------
-- Counted in SQL (never from the client cache). Insert +1, delete -1, relink moves the count.
create or replace function public.track_saved_usage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.saved_food_id is not null and (tg_op = 'DELETE' or new.saved_food_id is distinct from old.saved_food_id) then
      update public.saved_foods set times_used = greatest(times_used - 1, 0) where id = old.saved_food_id;
    end if;
    if old.saved_meal_id is not null and (tg_op = 'DELETE' or new.saved_meal_id is distinct from old.saved_meal_id) then
      update public.saved_meals set times_used = greatest(times_used - 1, 0) where id = old.saved_meal_id;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.saved_food_id is not null and (tg_op = 'INSERT' or new.saved_food_id is distinct from old.saved_food_id) then
      update public.saved_foods set times_used = times_used + 1 where id = new.saved_food_id;
    end if;
    if new.saved_meal_id is not null and (tg_op = 'INSERT' or new.saved_meal_id is distinct from old.saved_meal_id) then
      update public.saved_meals set times_used = times_used + 1 where id = new.saved_meal_id;
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger diary_entries_track_saved_usage
  after insert or delete or update of saved_food_id, saved_meal_id on public.diary_entries
  for each row execute function public.track_saved_usage();

-- upsert_saved_food ---------------------------------------------------------
-- Saves a food from search/scan (values per 100 g). If the user already has a food
-- with the same name (case/space insensitive) it is kept as is and its id returned.
create or replace function public.upsert_saved_food(
  p_name text,
  p_brand text,
  p_off_code text,
  p_calories_100g integer,
  p_protein_100g numeric,
  p_carbs_100g numeric,
  p_fat_100g numeric
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.saved_foods (name, brand, off_code, calories_100g, protein_100g, carbs_100g, fat_100g)
  values (trim(p_name), nullif(trim(p_brand), ''), nullif(trim(p_off_code), ''),
          p_calories_100g, p_protein_100g, p_carbs_100g, p_fat_100g)
  on conflict (user_id, lower(trim(name))) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.saved_foods
    where user_id = (select auth.uid()) and lower(trim(name)) = lower(trim(p_name));
  end if;
  return v_id;
end;
$$;

-- apply_saved_food ----------------------------------------------------------
-- Re-applies a saved food (name + values per 100 g) to the linked diary entries,
-- from p_from_date (inclusive) or the whole history when null. Rounding matches
-- scaleFromPer100g in lib/nutrition.ts: whole calories, macros with 1 decimal.
create or replace function public.apply_saved_food(p_food_id uuid, p_from_date date default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.diary_entries d set
    name = f.name,
    calories = round(f.calories_100g * d.quantity_g / 100),
    protein_g = round(f.protein_100g * d.quantity_g / 100, 1),
    carbs_g = round(f.carbs_100g * d.quantity_g / 100, 1),
    fat_g = round(f.fat_100g * d.quantity_g / 100, 1)
  from public.saved_foods f
  where f.id = p_food_id
    and d.saved_food_id = f.id
    and d.kind = 'food'
    and d.quantity_g is not null
    and (p_from_date is null or d.entry_date >= p_from_date);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- apply_saved_meal ----------------------------------------------------------
-- Re-applies a saved meal (name + items) to the linked diary entries, multiplying
-- each item by the entry's doses. Matches scaleMealItems + sumItems: items rounded
-- first (quantity whole grams, calories whole, macros 1 decimal), totals = rounded sum.
create or replace function public.apply_saved_meal(p_meal_id uuid, p_from_date date default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  with targets as (
    select d.id, m.name, m.items, coalesce(d.doses, 1) as doses
    from public.diary_entries d
    join public.saved_meals m on m.id = d.saved_meal_id
    where m.id = p_meal_id
      and d.kind = 'meal'
      and (p_from_date is null or d.entry_date >= p_from_date)
  ),
  scaled as (
    select t.id, t.name,
      case when t.doses = 1 then t.items else coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', i ->> 'name',
          'quantity_g', round((i ->> 'quantity_g')::numeric * t.doses),
          'calories', round((i ->> 'calories')::numeric * t.doses),
          'protein_g', round((i ->> 'protein_g')::numeric * t.doses, 1),
          'carbs_g', round((i ->> 'carbs_g')::numeric * t.doses, 1),
          'fat_g', round((i ->> 'fat_g')::numeric * t.doses, 1)
        ) order by ord)
        from jsonb_array_elements(t.items) with ordinality as e(i, ord)
      ), '[]'::jsonb) end as items
    from targets t
  ),
  totals as (
    select s.id, s.name, s.items,
      round(coalesce(sum((i ->> 'calories')::numeric), 0)) as calories,
      round(coalesce(sum((i ->> 'protein_g')::numeric), 0), 1) as protein_g,
      round(coalesce(sum((i ->> 'carbs_g')::numeric), 0), 1) as carbs_g,
      round(coalesce(sum((i ->> 'fat_g')::numeric), 0), 1) as fat_g
    from scaled s
    left join lateral jsonb_array_elements(s.items) as e(i) on true
    group by s.id, s.name, s.items
  )
  update public.diary_entries d set
    name = t.name,
    items = t.items,
    calories = t.calories,
    protein_g = t.protein_g,
    carbs_g = t.carbs_g,
    fat_g = t.fat_g
  from totals t
  where d.id = t.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only signed-in users may call the RPCs (RLS still scopes them to their own rows).
revoke execute on function public.upsert_saved_food(text, text, text, integer, numeric, numeric, numeric) from public, anon;
revoke execute on function public.apply_saved_food(uuid, date) from public, anon;
revoke execute on function public.apply_saved_meal(uuid, date) from public, anon;
grant execute on function public.upsert_saved_food(text, text, text, integer, numeric, numeric, numeric) to authenticated;
grant execute on function public.apply_saved_food(uuid, date) to authenticated;
grant execute on function public.apply_saved_meal(uuid, date) to authenticated;
revoke execute on function public.track_saved_usage() from public, anon, authenticated;
