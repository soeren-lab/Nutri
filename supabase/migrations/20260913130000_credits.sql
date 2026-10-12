-- Internes Guthaben (in US-Dollar) für den Foto-Scan: Aufladungen bucht der Admin manuell,
-- jeder Scan bucht seine Token-Kosten (plus Aufschlag) vom Guthaben ab.
create table public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_usd numeric(14, 6) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  -- positiv = Aufladung, negativ = Verbrauch
  amount_usd numeric(14, 6) not null,
  balance_after_usd numeric(14, 6) not null,
  note text,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  constraint credit_ledger_kind_check check (kind in ('topup', 'usage', 'adjustment'))
);

create index credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

grant select on public.user_credits to authenticated;
grant select on public.credit_ledger to authenticated;
grant all on public.user_credits to service_role;
grant all on public.credit_ledger to service_role;

alter table public.user_credits enable row level security;
alter table public.credit_ledger enable row level security;

-- Lesen: eigene Zeilen; Admins sehen alles. Schreiben nur über die Funktionen unten.
create policy "own credits readable" on public.user_credits
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "own ledger readable" on public.credit_ledger
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Verbrauch buchen: ein User kann nur das EIGENE Guthaben verringern (nie erhöhen).
create or replace function public.charge_credit_usage(
  _amount_usd numeric,
  _model text,
  _input_tokens integer,
  _output_tokens integer
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _balance numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  if _amount_usd is null or _amount_usd < 0 or _amount_usd > 5 then
    raise exception 'Ungültiger Betrag';
  end if;

  insert into public.user_credits (user_id, balance_usd)
  values (_uid, -_amount_usd)
  on conflict (user_id) do update
    set balance_usd = public.user_credits.balance_usd - _amount_usd,
        updated_at = now()
  returning balance_usd into _balance;

  insert into public.credit_ledger
    (user_id, kind, amount_usd, balance_after_usd, model, input_tokens, output_tokens)
  values (_uid, 'usage', -_amount_usd, _balance, _model, _input_tokens, _output_tokens);

  return _balance;
end;
$$;

-- Aufladen/Korrigieren: nur Admins (Prüfung innerhalb der Funktion, nicht nur im UI).
create or replace function public.admin_credit_topup(
  _user_id uuid,
  _amount_usd numeric,
  _note text default null,
  _kind text default 'topup'
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance numeric;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur für Admins';
  end if;
  if _kind not in ('topup', 'adjustment') then
    raise exception 'Ungültige Art';
  end if;
  if _amount_usd is null or _amount_usd = 0 or abs(_amount_usd) > 10000 then
    raise exception 'Ungültiger Betrag';
  end if;
  if _kind = 'topup' and _amount_usd < 0 then
    raise exception 'Eine Aufladung muss positiv sein';
  end if;

  insert into public.user_credits (user_id, balance_usd)
  values (_user_id, _amount_usd)
  on conflict (user_id) do update
    set balance_usd = public.user_credits.balance_usd + _amount_usd,
        updated_at = now()
  returning balance_usd into _balance;

  insert into public.credit_ledger (user_id, kind, amount_usd, balance_after_usd, note)
  values (_user_id, _kind, _amount_usd, _balance, nullif(trim(_note), ''));

  return _balance;
end;
$$;

-- Übersicht für Admins: alle User mit Guthaben, Aufladungen, Verbrauch und Scan-Anzahl.
create or replace function public.admin_credit_overview()
returns table (
  user_id uuid,
  username text,
  email text,
  balance_usd numeric,
  topped_up_usd numeric,
  used_usd numeric,
  scans bigint,
  last_used timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur für Admins';
  end if;
  return query
  select
    u.id,
    p.username,
    u.email::text,
    coalesce(c.balance_usd, 0),
    coalesce(l.topped_up, 0),
    coalesce(l.used, 0),
    coalesce(l.scans, 0),
    l.last_used
  from auth.users u
  left join public.user_profile p on p.user_id = u.id
  left join public.user_credits c on c.user_id = u.id
  left join (
    select
      cl.user_id,
      sum(case when cl.amount_usd > 0 then cl.amount_usd else 0 end) as topped_up,
      sum(case when cl.kind = 'usage' then -cl.amount_usd else 0 end) as used,
      count(*) filter (where cl.kind = 'usage') as scans,
      max(cl.created_at) filter (where cl.kind = 'usage') as last_used
    from public.credit_ledger cl
    group by cl.user_id
  ) l on l.user_id = u.id
  order by coalesce(l.used, 0) desc, u.created_at;
end;
$$;

revoke all on function public.charge_credit_usage(numeric, text, integer, integer) from public;
revoke all on function public.admin_credit_topup(uuid, numeric, text, text) from public;
revoke all on function public.admin_credit_overview() from public;
grant execute on function public.charge_credit_usage(numeric, text, integer, integer) to authenticated;
grant execute on function public.admin_credit_topup(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_credit_overview() to authenticated;
