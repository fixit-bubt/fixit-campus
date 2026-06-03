-- ============================================================================
-- FixIt — Migration 0012: connection requests (anti-harassment)
-- Contact is no longer broadcast. The directory shows only name/photo/intake/
-- section/department. To exchange contact, a student sends a connection
-- request; the other student accepts. Email + (opt-in) WhatsApp are revealed
-- ONLY between two students with an 'accepted' connection.
-- (Idempotent — safe to re-run.)
-- ============================================================================

create table if not exists public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists connections_requester_idx on public.connections (requester_id);
create index if not exists connections_addressee_idx on public.connections (addressee_id);

alter table public.connections enable row level security;
revoke all on public.connections from anon;
grant select, insert, update, delete on public.connections to authenticated;

-- Block a second request in EITHER direction (the unique index only blocks the
-- exact pair). Runs in a trigger so it can read the table without RLS ambiguity.
create or replace function public.guard_connection_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.connections c
    where (c.requester_id = new.requester_id and c.addressee_id = new.addressee_id)
       or (c.requester_id = new.addressee_id and c.addressee_id = new.requester_id)
  ) then
    raise exception 'A connection already exists between these users';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_connection_insert() from public, anon, authenticated;

drop trigger if exists connections_guard_insert on public.connections;
create trigger connections_guard_insert
  before insert on public.connections
  for each row execute function public.guard_connection_insert();

-- ---- RLS (drop-then-create so it's safe to re-run) ----
drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists connections_insert on public.connections;
create policy connections_insert on public.connections for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and requester_id <> addressee_id
    and public.is_student()
    and exists (
      select 1 from public.profiles a
      where a.id = addressee_id and a.role = 'student' and a.directory_visible = true
    )
  );

drop policy if exists connections_update on public.connections;
create policy connections_update on public.connections for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted', 'rejected'));

drop policy if exists connections_delete on public.connections;
create policy connections_delete on public.connections for delete to authenticated
  using (requester_id = auth.uid() and status = 'pending');

-- ---- Directory function: status + contact only when accepted ----
-- DROP first: the return columns changed from migration 0011 (added `status`).
drop function if exists public.student_directory();

create function public.student_directory()
returns table (
  id          uuid,
  full_name   text,
  avatar_url  text,
  department  text,
  intake      text,
  section     text,
  status      text,   -- 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted'
  email       text,
  whatsapp    text
)
language plpgsql security definer set search_path = public stable
as $$
declare
  uid uuid := auth.uid();
begin
  -- Reciprocity: only a visible student may browse.
  if not exists (
    select 1 from public.profiles m
    where m.id = uid and m.role = 'student' and m.directory_visible = true
  ) then
    return;
  end if;

  return query
  select
    p.id, p.full_name, p.avatar_url, p.department, p.intake, p.section,
    coalesce(cs.status_label, 'none') as status,
    case when cs.accepted then p.email else null end as email,
    case when cs.accepted and p.show_whatsapp then p.whatsapp else null end as whatsapp
  from public.profiles p
  left join lateral (
    select
      case
        when c.status = 'accepted' then 'accepted'
        when c.status = 'pending' and c.requester_id = uid then 'pending_outgoing'
        when c.status = 'pending' and c.addressee_id = uid then 'pending_incoming'
        else 'none'
      end as status_label,
      (c.status = 'accepted') as accepted
    from public.connections c
    where (c.requester_id = uid and c.addressee_id = p.id)
       or (c.addressee_id = uid and c.requester_id = p.id)
    order by c.created_at desc
    limit 1
  ) cs on true
  where p.role = 'student'
    and p.directory_visible = true
    and p.id <> uid
  order by p.full_name;
end;
$$;

revoke execute on function public.student_directory() from public, anon;
grant  execute on function public.student_directory() to authenticated;
