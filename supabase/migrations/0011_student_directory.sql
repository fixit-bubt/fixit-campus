-- ============================================================================
-- FixIt — Migration 0011: student directory
-- Lets students find each other (e.g. to ask a senior/junior for notes).
-- Two privacy controls on the profile:
--   • directory_visible — appear in the list AND be able to browse it
--     (turning it off hides you and blocks you from browsing — reciprocal);
--   • show_whatsapp      — whether your WhatsApp number is shown to others.
-- The directory is exposed ONLY through the student_directory() function,
-- which returns visible students to a visible student (never to staff/admin,
-- never to a hidden student), and blanks out WhatsApp unless the user shares it.
-- ============================================================================

alter table public.profiles
  add column if not exists directory_visible boolean not null default true,
  add column if not exists show_whatsapp     boolean not null default false;

create or replace function public.student_directory()
returns table (
  id          uuid,
  full_name   text,
  avatar_url  text,
  department  text,
  intake      text,
  section     text,
  email       text,
  whatsapp    text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.full_name, p.avatar_url, p.department, p.intake, p.section, p.email,
    case when p.show_whatsapp then p.whatsapp else null end as whatsapp
  from public.profiles p
  where p.role = 'student'
    and p.directory_visible = true
    and p.id <> auth.uid()
    -- reciprocity: only a *visible student* may browse the directory
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role = 'student'
        and me.directory_visible = true
    )
  order by p.full_name;
$$;

revoke execute on function public.student_directory() from public, anon;
grant  execute on function public.student_directory() to authenticated;
