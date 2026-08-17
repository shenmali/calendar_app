alter function public.enforce_calendar_source_owner()
  set search_path = public;

alter function public.enforce_calendar_event_owner()
  set search_path = public;

create index if not exists calendar_events_source_id_idx
  on public.calendar_events (source_id);

create index if not exists oauth_state_nonces_user_id_idx
  on public.oauth_state_nonces (user_id);

create index if not exists sync_runs_connection_id_idx
  on public.sync_runs (connection_id);

create index if not exists sync_runs_source_id_idx
  on public.sync_runs (source_id);
