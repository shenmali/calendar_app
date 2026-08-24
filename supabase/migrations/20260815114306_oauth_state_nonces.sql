create table public.oauth_state_nonces (
  nonce text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_state_nonces_expiry_check check (expires_at > created_at)
);

create index oauth_state_nonces_unconsumed_idx
on public.oauth_state_nonces (expires_at)
where consumed_at is null;

alter table public.oauth_state_nonces enable row level security;

revoke all on table public.oauth_state_nonces from anon, authenticated;
grant select, insert, update, delete on table public.oauth_state_nonces to service_role;
