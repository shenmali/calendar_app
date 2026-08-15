create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_matches_user_id check (id = user_id)
);

create table public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  remote_version text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oauth_connections_provider_account_key unique (provider, provider_account_id)
);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.oauth_connections (id) on delete cascade,
  remote_calendar_id text not null,
  remote_version text,
  name text not null,
  description text,
  time_zone text,
  color text,
  is_primary boolean not null default false,
  is_selected boolean not null default true,
  sync_cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.oauth_connections (id) on delete cascade,
  source_id uuid not null references public.calendar_sources (id) on delete cascade,
  remote_event_id text not null,
  remote_version text,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'confirmed',
  attendees jsonb not null default '[]'::jsonb,
  remote_updated_at timestamptz,
  last_synced_at timestamptz,
  sync_state text not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_time_range check (ends_at >= starts_at)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.oauth_connections (id) on delete set null,
  source_id uuid references public.calendar_sources (id) on delete set null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cursor_before text,
  cursor_after text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sync_runs_completion_after_start check (
    completed_at is null or completed_at >= started_at
  )
);

create unique index calendar_events_remote_key
on public.calendar_events (connection_id, remote_event_id);

create unique index calendar_sources_remote_key
on public.calendar_sources (connection_id, remote_calendar_id);

create index oauth_connections_user_id_idx
on public.oauth_connections (user_id);

create index calendar_sources_user_id_idx
on public.calendar_sources (user_id);

create index calendar_events_user_id_idx
on public.calendar_events (user_id);

create index sync_runs_user_id_idx
on public.sync_runs (user_id);

alter table public.profiles enable row level security;
alter table public.oauth_connections enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_events enable row level security;
alter table public.sync_runs enable row level security;

create policy "Profiles are readable by their owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Calendar sources are readable by their owner"
on public.calendar_sources
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Calendar events are readable by their owner"
on public.calendar_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Sync runs are readable by their owner"
on public.sync_runs
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles, public.calendar_sources,
  public.calendar_events, public.sync_runs from anon, authenticated;
revoke all on table public.oauth_connections from anon, authenticated;

grant select on table public.profiles, public.calendar_sources,
  public.calendar_events, public.sync_runs to authenticated;

grant select, insert, update, delete on table public.profiles,
  public.oauth_connections, public.calendar_sources, public.calendar_events,
  public.sync_runs to service_role;
