-- History insights: what is eaten most and where the calories come from.
-- SECURITY INVOKER (default): RLS applies, so a user only ever reads their own entries.
-- Done in SQL (like diary_daily_totals) because PostgREST returns at most 1000 rows per request.

-- The foods and meals eaten most in a period, grouped by name (case and spaces ignored) and kind.
-- p_order 'times': most entries first; 'calories': most calories first. The name is the latest spelling.
create or replace function public.diary_top_items(p_from date, p_to date, p_order text, p_limit integer default 5)
returns table (
  name text,
  kind text,
  times integer,
  total_calories integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if p_to - p_from > 3660 then
    raise exception 'date range too large (max 3660 days)' using errcode = '22023';
  end if;
  if p_order not in ('times', 'calories') then
    raise exception 'invalid order' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;

  return query
  select
    btrim((array_agg(d.name order by d.entry_date desc, d.created_at desc))[1]),
    d.kind,
    count(*)::integer,
    sum(d.calories)::integer
  from public.diary_entries d
  where d.user_id = (select auth.uid())
    and d.entry_date between p_from and p_to
  group by lower(trim(d.name)), d.kind
  order by
    case when p_order = 'times' then count(*) else sum(d.calories) end desc,
    sum(d.calories) desc,
    lower(trim(min(d.name))),
    d.kind
  limit p_limit;
end;
$$;

-- Calories per meal (breakfast, lunch, dinner, snacks) in a period: one row per meal that has entries.
create or replace function public.diary_meal_totals(p_from date, p_to date)
returns table (
  meal text,
  calories integer,
  entries integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if p_to - p_from > 3660 then
    raise exception 'date range too large (max 3660 days)' using errcode = '22023';
  end if;

  return query
  select d.meal, sum(d.calories)::integer, count(*)::integer
  from public.diary_entries d
  where d.user_id = (select auth.uid())
    and d.entry_date between p_from and p_to
  group by d.meal;
end;
$$;

revoke execute on function public.diary_top_items(date, date, text, integer) from public, anon;
grant execute on function public.diary_top_items(date, date, text, integer) to authenticated;
revoke execute on function public.diary_meal_totals(date, date) from public, anon;
grant execute on function public.diary_meal_totals(date, date) to authenticated;
