-- ============================================================================
-- FixIt — Migration 0075: Lost & Found match notifications
-- ----------------------------------------------------------------------------
-- When a new item is posted, notify posters of OPPOSITE-type items in the same
-- category (open, not deleted, item_date within ±60 days, max 10 people) that a
-- possible match appeared. Self-contained SECURITY DEFINER trigger that inserts
-- into notifications directly — the production DB has its own notify_* trigger
-- functions and does NOT have 0067's create_notification() helper, so this
-- respects notif_prefs (master pause + lostfound sector toggle) inline.
-- ============================================================================

create or replace function public.notify_lostfound_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  for m in
    select distinct on (i.poster_id) i.poster_id
    from lost_found_items i
    where i.type <> new.type
      and i.category = new.category
      and i.status = 'Open'
      and i.deleted_at is null
      and i.poster_id <> new.poster_id
      and i.item_date between (new.item_date - 60) and (new.item_date + 60)
    order by i.poster_id, i.created_at desc
    limit 10
  loop
    if not exists (
         select 1 from notif_prefs
         where user_id = m.poster_id and sector = '_paused' and enabled
       )
       and coalesce((
         select enabled from notif_prefs
         where user_id = m.poster_id and sector = 'lostfound'
       ), true)
    then
      insert into notifications (user_id, sector, title, body, reference_id, reference_type)
      values (
        m.poster_id,
        'lostfound',
        case when new.type = 'Found'
          then 'Possible match: someone found an item'
          else 'Possible match: someone lost an item' end,
        new.title || ' (' || new.category || ') — ' || new.location,
        new.id,
        'lost_found_item'
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_lostfound_match() from public, anon;

drop trigger if exists lostfound_match_notify on public.lost_found_items;
create trigger lostfound_match_notify
  after insert on public.lost_found_items
  for each row execute function public.notify_lostfound_match();
