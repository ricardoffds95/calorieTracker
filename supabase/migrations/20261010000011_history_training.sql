-- History: how many trainings were done on each day of a period.
-- Like diary_daily_totals: one row per day that has trainings (at most 3661), summed in SQL.
-- security invoker (the default): RLS keeps every user inside their own trainings. Uses training_entries_user_date_idx.

create or replace function public.training_daily_counts(p_from date, p_to date)
returns table (
  entry_date date,
  trainings integer
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
  select t.entry_date, count(*)::integer
  from public.training_entries t
  where t.user_id = (select auth.uid())
    and t.entry_date between p_from and p_to
  group by t.entry_date
  order by t.entry_date;
end;
$$;

revoke execute on function public.training_daily_counts(date, date) from public, anon;
grant execute on function public.training_daily_counts(date, date) to authenticated;
