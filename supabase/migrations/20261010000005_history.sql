-- History screen: per-day totals for a period (averages are computed from these in the client).
-- SECURITY INVOKER: RLS applies, so a user only ever sums their own entries.
-- Done in SQL because PostgREST returns at most 1000 rows per request and a year of diary has more;
-- this returns at most one row per day with entries (366 per year). Uses diary_entries_user_date_idx.

create or replace function public.diary_daily_totals(p_from date, p_to date)
returns table (
  entry_date date,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
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
  select
    d.entry_date,
    sum(d.calories)::integer,
    round(sum(d.protein_g), 1),
    round(sum(d.carbs_g), 1),
    round(sum(d.fat_g), 1),
    count(*)::integer
  from public.diary_entries d
  where d.user_id = (select auth.uid())
    and d.entry_date between p_from and p_to
  group by d.entry_date
  order by d.entry_date;
end;
$$;

revoke execute on function public.diary_daily_totals(date, date) from public, anon;
grant execute on function public.diary_daily_totals(date, date) to authenticated;
