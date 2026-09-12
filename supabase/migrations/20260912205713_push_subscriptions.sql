create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fcm_token)
);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions readable" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own push subscriptions insert" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own push subscriptions update" on public.push_subscriptions for update to authenticated using (user_id = auth.uid());
create policy "own push subscriptions delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Gibt alle FCM-Tokens außer dem des Aufrufers zurück, aber nur wenn der
-- Aufrufer Admin ist (has_role-Check innerhalb der security-definer-Funktion,
-- nicht nur im Client versteckt) - so kommt der Broadcast-Versand ohne den
-- service_role-Key aus, der normale RLS-authentifizierte Client reicht.
create or replace function public.get_other_push_tokens(_exclude_user_id uuid)
returns table(fcm_token text) language sql stable security definer set search_path = public as $$
  select fcm_token from public.push_subscriptions
  where user_id != _exclude_user_id
    and public.has_role(auth.uid(), 'admin')
$$;
grant execute on function public.get_other_push_tokens(uuid) to authenticated;
