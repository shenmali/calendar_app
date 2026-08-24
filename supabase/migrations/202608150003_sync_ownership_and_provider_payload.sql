alter table public.calendar_events
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists remote_series_id text,
  add column if not exists remote_original_start text;

create or replace function public.enforce_calendar_source_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.oauth_connections connection
    where connection.id = new.connection_id and connection.user_id = new.user_id
  ) then
    raise exception 'calendar source owner must match its connection owner';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_calendar_event_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.calendar_sources source
    join public.oauth_connections connection on connection.id = source.connection_id
    where source.id = new.source_id
      and source.connection_id = new.connection_id
      and source.user_id = new.user_id
      and connection.user_id = new.user_id
  ) then
    raise exception 'calendar event owner, source, and connection must match';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_sources_owner_matches_connection on public.calendar_sources;
create trigger calendar_sources_owner_matches_connection
before insert or update of user_id, connection_id on public.calendar_sources
for each row execute function public.enforce_calendar_source_owner();

drop trigger if exists calendar_events_owner_matches_source on public.calendar_events;
create trigger calendar_events_owner_matches_source
before insert or update of user_id, connection_id, source_id on public.calendar_events
for each row execute function public.enforce_calendar_event_owner();
