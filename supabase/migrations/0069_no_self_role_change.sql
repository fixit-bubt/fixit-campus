-- ============================================================================
-- FixIt — Migration 0069: an admin cannot change their OWN role
-- The last-admin guard (0009) only blocks demoting the final admin. With two or
-- more admins, an admin could still demote THEMSELVES to Staff/Student and lose
-- access to admin tools by accident. This trigger blocks any self role change;
-- another admin must do it. (SECURITY DEFINER so the check isn't filtered by RLS.)
--
-- Console seeding (auth.uid() is null) and admins editing OTHER users are
-- unaffected — the guard only fires when the acting user edits their own row.
-- ============================================================================

create or replace function public.guard_no_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and old.id = auth.uid() then
    raise exception 'You cannot change your own role — ask another admin to do it';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_no_self_role_change() from public, anon, authenticated;

drop trigger if exists profiles_no_self_role_change on public.profiles;
create trigger profiles_no_self_role_change
  before update on public.profiles
  for each row execute function public.guard_no_self_role_change();
