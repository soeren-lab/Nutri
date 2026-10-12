-- Abo-Plan pro User (free/pro/max). Bewusst eigene Tabelle statt Spalte in
-- user_profile: dort darf jeder User seine Zeile frei ändern (Policy FOR ALL),
-- den Plan dürfen aber nur service_role / SQL-Editor setzen. Keine Zeile = free.
create table public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plans_plan_check check (plan in ('free', 'pro', 'max'))
);

grant select on public.user_plans to authenticated;
grant all on public.user_plans to service_role;

alter table public.user_plans enable row level security;

create policy "own plan readable" on public.user_plans
  for select to authenticated using (user_id = auth.uid());

create trigger update_user_plans_updated_at
  before update on public.user_plans
  for each row execute function public.update_updated_at_column();
