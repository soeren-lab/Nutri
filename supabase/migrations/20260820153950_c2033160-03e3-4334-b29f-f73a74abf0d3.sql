create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

insert into public.user_roles (user_id, role) values ('0cb3a06e-763b-4383-a372-46e89d8e9b30','admin');

create table public.patch_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id) on delete cascade
);
grant select on public.patch_notes to authenticated;
grant all on public.patch_notes to service_role;
alter table public.patch_notes enable row level security;
create policy "patch notes readable" on public.patch_notes for select to authenticated using (true);
create policy "admins insert patch notes" on public.patch_notes for insert to authenticated with check (public.has_role(auth.uid(),'admin') and published_by = auth.uid());
create policy "admins update patch notes" on public.patch_notes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete patch notes" on public.patch_notes for delete to authenticated using (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.patch_notes to authenticated;

create table public.patch_note_sections (
  id uuid primary key default gen_random_uuid(),
  patch_note_id uuid not null references public.patch_notes(id) on delete cascade,
  subtitle text not null default '',
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.patch_note_sections to authenticated;
grant all on public.patch_note_sections to service_role;
alter table public.patch_note_sections enable row level security;
create policy "sections readable" on public.patch_note_sections for select to authenticated using (true);
create policy "admins manage sections" on public.patch_note_sections for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create index patch_note_sections_note_idx on public.patch_note_sections(patch_note_id, sort_order);

create table public.user_seen_patch_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  patch_note_id uuid not null references public.patch_notes(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, patch_note_id)
);
grant select, insert, delete on public.user_seen_patch_notes to authenticated;
grant all on public.user_seen_patch_notes to service_role;
alter table public.user_seen_patch_notes enable row level security;
create policy "own seen readable" on public.user_seen_patch_notes for select to authenticated using (user_id = auth.uid());
create policy "own seen insert" on public.user_seen_patch_notes for insert to authenticated with check (user_id = auth.uid());
create policy "own seen delete" on public.user_seen_patch_notes for delete to authenticated using (user_id = auth.uid());