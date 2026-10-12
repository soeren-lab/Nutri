-- Eigene Teller/Schüsseln mit Maßen als Maßstab für den Foto-Scan.
-- Fotos liegen im privaten Bucket meal-photos unter <user_id>/plate-<id>.jpg
-- (Policies dafür existieren bereits, siehe 20260913090000_photo_scan.sql).
create table public.user_plates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  shape text not null default 'round',
  -- Durchmesser (rund/Schüssel) bzw. Breite (oval/eckig)
  width_cm numeric not null,
  -- Länge nur bei ovalen/eckigen Tellern
  length_cm numeric,
  -- Tiefe bzw. Randhöhe
  depth_cm numeric not null,
  -- Fassungsvermögen bis zum Rand (optional, v. a. für Schüsseln)
  capacity_ml numeric,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plates_shape_check check (shape in ('round', 'oval', 'bowl')),
  constraint user_plates_size_check check (
    width_cm > 0 and width_cm <= 100
    and (length_cm is null or (length_cm > 0 and length_cm <= 100))
    and depth_cm > 0 and depth_cm <= 50
    and (capacity_ml is null or (capacity_ml > 0 and capacity_ml <= 10000))
  )
);

create index user_plates_user_idx on public.user_plates (user_id);

grant select, insert, update, delete on public.user_plates to authenticated;
grant all on public.user_plates to service_role;
alter table public.user_plates enable row level security;

create policy "own plates" on public.user_plates
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger update_user_plates_updated_at
  before update on public.user_plates
  for each row execute function public.update_updated_at_column();
