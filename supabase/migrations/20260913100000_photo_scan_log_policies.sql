-- Tageslimit des Foto-Scans ohne Service-Role-Key: der Server zählt und schreibt mit der
-- Session des Users. Löschen/Ändern ist nicht erlaubt, damit das Limit nicht zurückgesetzt
-- werden kann.
grant select, insert on public.photo_scan_log to authenticated;

drop policy if exists "photo_scan_log own read" on public.photo_scan_log;
create policy "photo_scan_log own read" on public.photo_scan_log
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "photo_scan_log own insert" on public.photo_scan_log;
create policy "photo_scan_log own insert" on public.photo_scan_log
  for insert to authenticated with check (user_id = auth.uid());
