-- ============================================================================
-- FixIt — Migration 0009: never let the last admin be demoted
-- An admin could demote the last remaining admin (including themselves),
-- leaving zero admins and locking everyone out of user management. This
-- trigger blocks any role change that would drop the admin count to zero.
-- (SECURITY DEFINER so the count isn't filtered by RLS.)
-- ============================================================================

create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last admin — promote another admin first';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_last_admin() from public, anon, authenticated;

drop trigger if exists profiles_guard_last_admin on public.profiles;
create trigger profiles_guard_last_admin
  before update on public.profiles
  for each row execute function public.guard_last_admin();
