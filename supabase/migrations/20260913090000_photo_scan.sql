-- Foto-Scan im Planer (Max): Tellerfoto + erkannte Positionen am Planer-Eintrag,
-- privater Storage-Bucket und ein Nutzungs-Log für das serverseitige Tageslimit.

alter table public.meal_plan_entries
  add column if not exists photo_path text,
  add column if not exists photo_items jsonb;

-- Privater Bucket, Pfad: <user_id>/<entry_id>.jpg
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "meal-photos own read" on storage.objects;
create policy "meal-photos own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal-photos own insert" on storage.objects;
create policy "meal-photos own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal-photos own update" on storage.objects;
create policy "meal-photos own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal-photos own delete" on storage.objects;
create policy "meal-photos own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Tageslimit: nur der Server (service_role) liest/schreibt, Clients haben keinen Zugriff,
-- damit das Limit nicht durch Löschen von Log-Zeilen umgangen werden kann.
create table public.photo_scan_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index photo_scan_log_user_created_idx on public.photo_scan_log (user_id, created_at desc);
grant all on public.photo_scan_log to service_role;
alter table public.photo_scan_log enable row level security;
