-- ============================================================================
-- FixIt — Migration 0013: fix declining a connection + tighten requests
--  • Declining a request now DELETES the pending row (instead of leaving a
--    'rejected' row that blocked the requester from ever asking again while
--    the UI still showed a "Connect" button). So the addressee must be able
--    to delete a pending request too — not just the requester (who cancels).
--  • A *hidden* student (directory_visible = false) can no longer SEND a
--    request — such a request would be invisible to the addressee anyway.
-- ============================================================================

-- Either party may delete a still-pending request (requester cancels / addressee declines).
drop policy if exists connections_delete on public.connections;
create policy connections_delete on public.connections for delete to authenticated
  using (
    status = 'pending'
    and (requester_id = auth.uid() or addressee_id = auth.uid())
  );

-- Sender must also be a visible student.
drop policy if exists connections_insert on public.connections;
create policy connections_insert on public.connections for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and requester_id <> addressee_id
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'student' and me.directory_visible = true
    )
    and exists (
      select 1 from public.profiles a
      where a.id = addressee_id and a.role = 'student' and a.directory_visible = true
    )
  );
