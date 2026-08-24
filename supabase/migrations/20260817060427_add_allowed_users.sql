create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint allowed_users_normalized_email check (email = lower(trim(email))),
  constraint allowed_users_revocation_state check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index allowed_users_active_email_idx
  on public.allowed_users (email)
  where status = 'active';

alter table public.allowed_users enable row level security;

revoke all on table public.allowed_users from anon, authenticated;
grant select, insert, update, delete on table public.allowed_users to service_role;
