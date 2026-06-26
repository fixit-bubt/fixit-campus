-- 0065 — Onboarding profile fields
-- Adds student_id, blood_group, phone, program, address to profiles and surfaces
-- the public-safe ones (program, blood_group) in public_profiles + student_directory.

alter table public.profiles
  add column if not exists student_id text,
  add column if not exists blood_group text,
  add column if not exists phone text,
  add column if not exists program text,
  add column if not exists address text;

-- Append new public-safe columns (keep existing order so CREATE OR REPLACE keeps grants).
create or replace view public.public_profiles as
  select id, full_name, role, department, expertise, avatar_url, program, blood_group
  from public.profiles;

-- Recreate directory RPC with program + blood_group added.
drop function if exists public.student_directory();
create function public.student_directory()
returns table(id uuid, full_name text, avatar_url text, department text, program text,
              intake text, section text, blood_group text, status text, email text, whatsapp text)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.profiles m
    where m.id = uid and m.role = 'student' and m.directory_visible = true
  ) then
    return;
  end if;

  return query
  select
    p.id, p.full_name, p.avatar_url, p.department, p.program, p.intake, p.section, p.blood_group,
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
$function$;

grant execute on function public.student_directory() to authenticated;
