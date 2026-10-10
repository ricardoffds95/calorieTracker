-- Row Level Security: each user only accesses their own rows. No access for anon.

alter table public.profiles enable row level security;
alter table public.saved_foods enable row level security;
alter table public.saved_meals enable row level security;
alter table public.diary_entries enable row level security;

-- profiles (created by trigger; users cannot insert/delete them directly)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- saved_foods
create policy "saved_foods_select_own" on public.saved_foods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_foods_insert_own" on public.saved_foods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_foods_update_own" on public.saved_foods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "saved_foods_delete_own" on public.saved_foods
  for delete to authenticated using (user_id = (select auth.uid()));

-- saved_meals
create policy "saved_meals_select_own" on public.saved_meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_meals_insert_own" on public.saved_meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_meals_update_own" on public.saved_meals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "saved_meals_delete_own" on public.saved_meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- diary_entries
create policy "diary_entries_select_own" on public.diary_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "diary_entries_insert_own" on public.diary_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "diary_entries_update_own" on public.diary_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "diary_entries_delete_own" on public.diary_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Explicit grants: anon gets nothing, authenticated only what the policies allow.
revoke all on public.profiles, public.saved_foods, public.saved_meals, public.diary_entries from anon;
revoke all on public.profiles, public.saved_foods, public.saved_meals, public.diary_entries from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_foods, public.saved_meals, public.diary_entries to authenticated;
