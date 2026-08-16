alter table public.oauth_connections
  add column if not exists is_active boolean not null default true;

create index if not exists oauth_connections_active_user_id_idx
  on public.oauth_connections (user_id)
  where is_active;

create table public.sync_locks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_locks enable row level security;
revoke all on table public.sync_locks from anon, authenticated;
grant select, insert, update, delete on table public.sync_locks to service_role;

create or replace function public.acquire_sync_lock(
  p_user_id uuid,
  p_owner_id uuid,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  acquired boolean;
begin
  if p_ttl_seconds < 1 or p_ttl_seconds > 900 then
    raise exception 'sync lock ttl is out of range';
  end if;

  insert into public.sync_locks (user_id, owner_id, locked_until)
  values (p_user_id, p_owner_id, now() + make_interval(secs => p_ttl_seconds))
  on conflict (user_id) do update
    set owner_id = excluded.owner_id,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.sync_locks.locked_until <= now()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_sync_lock(p_user_id uuid, p_owner_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.sync_locks
  where user_id = p_user_id and owner_id = p_owner_id;
  return found;
end;
$$;

revoke all on function public.acquire_sync_lock(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_sync_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acquire_sync_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_sync_lock(uuid, uuid) to service_role;
