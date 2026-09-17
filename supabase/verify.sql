-- Run in Supabase SQL Editor after migrations. Reads metadata and counts only.
-- It never changes records or displays names, passwords, tokens or keys.
do $$
declare
  table_name text;
  role_name text;
  operation text;
  signature text;
begin
  foreach table_name in array array[
    'users', 'game_dates', 'seats', 'reservations', 'reservation_events',
    'app_sessions', 'auth_attempts', 'winner_results', 'all_time_winners'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then
      raise exception 'MISSING_TABLE_OR_RLS: %', table_name;
    end if;
    foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('service_role', 'public.' || table_name, operation) then
        raise exception 'MISSING_SERVER_PERMISSION: % %', table_name, operation;
      end if;
    end loop;
    foreach role_name in array array['anon', 'authenticated'] loop
      foreach operation in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(role_name, 'public.' || table_name, operation) then
          raise exception 'UNEXPECTED_BROWSER_PERMISSION: % % %', role_name, table_name, operation;
        end if;
      end loop;
      if table_name in ('users', 'reservations', 'reservation_events', 'app_sessions', 'auth_attempts')
        and has_table_privilege(role_name, 'public.' || table_name, 'SELECT') then
        raise exception 'PRIVATE_TABLE_EXPOSED: % %', role_name, table_name;
      end if;
    end loop;
  end loop;

  foreach signature in array array[
    'take_auth_attempt(text,integer)', 'create_game_date_secure(uuid,timestamp with time zone)',
    'reserve_game_seat(uuid,uuid)', 'cancel_game_seat(uuid,uuid)', 'reject_game_reservation(uuid,uuid)'
  ] loop
    if to_regprocedure('public.' || signature) is null then
      raise exception 'MISSING_FUNCTION: %', signature;
    end if;
    if not has_function_privilege('service_role', 'public.' || signature, 'EXECUTE')
      or has_function_privilege('anon', 'public.' || signature, 'EXECUTE')
      or has_function_privilege('authenticated', 'public.' || signature, 'EXECUTE') then
      raise exception 'INVALID_FUNCTION_PERMISSIONS: %', signature;
    end if;
  end loop;
  if to_regprocedure('public.create_game_date(timestamp with time zone)') is not null then
    raise exception 'LEGACY_UNRESTRICTED_FUNCTION_EXISTS';
  end if;
  if to_regclass('public.reservation_events_occurred_at_id') is null then
    raise exception 'MISSING_RESERVATION_EVENT_RETENTION_INDEX';
  end if;
  if exists (
    select 1 from public.game_dates g left join public.seats s on s.game_date_id = g.id
    group by g.id having count(s.id) <> 16
  ) then
    raise exception 'INVALID_GAME_CAPACITY: every game must have 16 seats';
  end if;
end;
$$;

select 'OK: lentelės, RLS, serverio teisės, funkcijos, istorijos indeksas ir 16 vietų kiekvienam žaidimui' as result;
