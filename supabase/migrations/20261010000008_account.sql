-- Account menu: the chosen avatar, and deleting one's own account.

alter table public.profiles add column avatar text check (char_length(avatar) <= 32);

-- Deletes the signed-in user's account. Every table that holds their data references auth.users with
-- "on delete cascade" (profile, saved foods, saved meals, diary), so deleting the auth user removes it all.
-- SECURITY DEFINER because the user cannot delete from auth.users themselves; it only ever touches auth.uid().
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
