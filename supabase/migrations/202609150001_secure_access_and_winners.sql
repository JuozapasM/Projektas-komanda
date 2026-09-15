begin;

-- Custom name/password authentication is handled by the application server.
-- Browser API keys must never read credentials or mutate reservations.
drop policy if exists "public can view users" on public.users;
drop policy if exists "public can register participants" on public.users;
drop policy if exists "public can view reservations" on public.reservations;
drop policy if exists "public can create active reservations" on public.reservations;
drop policy if exists "public can cancel reservations" on public.reservations;
drop policy if exists "public can view reservation events" on public.reservation_events;
drop policy if exists "public can write reservation events" on public.reservation_events;
revoke all on public.users, public.reservations, public.reservation_events from public, anon, authenticated;
revoke all on public.game_dates, public.seats from public, anon, authenticated;
grant select on public.game_dates, public.seats to anon, authenticated;
grant all on public.users, public.reservations, public.reservation_events, public.game_dates, public.seats to service_role;

-- Prevent case/whitespace variants of an existing login name.
create unique index users_normalized_name on public.users (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- Disable the previously published seeded administrator credential.
-- Set a new password with npm run setup:admin after applying this migration.
update public.users set password_hash = '!disabled:' || gen_random_uuid()::text
where role = 'admin' and password_hash = '$2b$10$V2GD1/CRykrha3K1jYoNeOv6fFwQtEKF5pr48egIO5F1LLm2Uafmm';

create table public.app_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index app_sessions_expiry on public.app_sessions(expires_at);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from public, anon, authenticated;
grant all on public.app_sessions to service_role;

create table public.auth_attempts (
  bucket text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from public, anon, authenticated;
grant all on public.auth_attempts to service_role;

create function public.take_auth_attempt(bucket_key text, max_attempts integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare attempt_count integer;
begin
  if max_attempts < 1 or max_attempts > 100 or length(bucket_key) <> 64 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;
  delete from public.auth_attempts where expires_at < now() - interval '1 day';
  insert into public.auth_attempts (bucket, attempts, expires_at)
  values (bucket_key, 1, now() + interval '15 minutes')
  on conflict (bucket) do update set
    attempts = case when auth_attempts.expires_at <= now() then 1 else least(auth_attempts.attempts + 1, 101) end,
    expires_at = case when auth_attempts.expires_at <= now() then now() + interval '15 minutes' else auth_attempts.expires_at end
  returning attempts into attempt_count;
  return attempt_count <= max_attempts;
end;
$$;

-- Replace the unrestricted security-definer function with an admin-only path.
drop function public.create_game_date(timestamptz);
create function public.create_game_date_secure(actor_id uuid, date_time timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_game_id uuid;
begin
  if not exists (select 1 from public.users where id = actor_id and role = 'admin') then
    raise exception 'FORBIDDEN';
  end if;
  if date_time is null then raise exception 'INVALID_DATE'; end if;
  insert into public.game_dates (starts_at) values (date_time) returning id into new_game_id;
  insert into public.seats (game_date_id, table_number, seat_number)
  select new_game_id, t, s from generate_series(1, 4) t cross join generate_series(1, 4) s;
  return new_game_id;
end;
$$;

create function public.reserve_game_seat(actor_id uuid, game_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare chosen public.seats; reservation uuid; user_name text;
begin
  -- Serialize reservations for this game; allocation and audit are one transaction.
  perform 1 from public.game_dates where id = game_id and is_open for update;
  if not found then raise exception 'GAME_CLOSED'; end if;
  select name into user_name from public.users where id = actor_id;
  if not found then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.reservations where game_date_id = game_id and user_id = actor_id and status = 'active') then
    raise unique_violation using message = 'ALREADY_RESERVED';
  end if;
  select s.* into chosen from public.seats s
  where s.game_date_id = game_id and not exists (
    select 1 from public.reservations r where r.seat_id = s.id and r.status = 'active'
  ) order by random() limit 1;
  if not found then raise exception 'NO_SEATS'; end if;
  insert into public.reservations (game_date_id, seat_id, user_id)
  values (game_id, chosen.id, actor_id) returning id into reservation;
  insert into public.reservation_events (reservation_id, game_date_id, user_name, table_number, seat_number, action)
  values (reservation, game_id, user_name, chosen.table_number, chosen.seat_number, 'reserved');
  return jsonb_build_object('id', chosen.id, 'table_number', chosen.table_number, 'seat_number', chosen.seat_number);
end;
$$;

create function public.cancel_game_seat(actor_id uuid, game_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare reservation public.reservations; chosen public.seats; user_name text;
begin
  select * into reservation from public.reservations
  where game_date_id = game_id and user_id = actor_id and status = 'active' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = reservation.id;
  select * into chosen from public.seats where id = reservation.seat_id;
  select name into user_name from public.users where id = actor_id;
  insert into public.reservation_events (reservation_id, game_date_id, user_name, table_number, seat_number, action)
  values (reservation.id, game_id, user_name, chosen.table_number, chosen.seat_number, 'cancelled');
end;
$$;

create function public.reject_game_reservation(actor_id uuid, reservation_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare reservation public.reservations; chosen public.seats; user_name text;
begin
  if not exists (select 1 from public.users where id = actor_id and role = 'admin') then raise exception 'FORBIDDEN'; end if;
  select r.* into reservation from public.reservations r where r.id = reservation_id and r.status = 'active' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.reservations set status = 'rejected', cancelled_at = now() where id = reservation.id;
  select * into chosen from public.seats where id = reservation.seat_id;
  select name into user_name from public.users where id = reservation.user_id;
  insert into public.reservation_events (reservation_id, game_date_id, user_name, table_number, seat_number, action)
  values (reservation.id, reservation.game_date_id, user_name, chosen.table_number, chosen.seat_number, 'rejected');
end;
$$;

revoke all on function public.take_auth_attempt(text, integer), public.create_game_date_secure(uuid, timestamptz),
  public.reserve_game_seat(uuid, uuid), public.cancel_game_seat(uuid, uuid), public.reject_game_reservation(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.take_auth_attempt(text, integer), public.create_game_date_secure(uuid, timestamptz),
  public.reserve_game_seat(uuid, uuid), public.cancel_game_seat(uuid, uuid), public.reject_game_reservation(uuid, uuid)
to service_role;

create table public.winner_results (
  id smallint primary key check (id = 1),
  teams jsonb not null check (jsonb_typeof(teams) = 'array' and jsonb_array_length(teams) = 3),
  updated_at timestamptz not null default now()
);
create table public.all_time_winners (
  name text primary key,
  points integer not null check (points >= 0),
  games_played integer not null check (games_played >= 0)
);
alter table public.winner_results enable row level security;
alter table public.all_time_winners enable row level security;
revoke all on public.winner_results, public.all_time_winners from public, anon, authenticated;
grant select on public.winner_results, public.all_time_winners to anon, authenticated;
grant all on public.winner_results, public.all_time_winners to service_role;
create policy "public can view winner results" on public.winner_results for select to anon, authenticated using (true);
create policy "public can view all time winners" on public.all_time_winners for select to anon, authenticated using (true);

-- Preserve the existing published results when moving them to durable storage.
insert into public.winner_results (id, teams) values (1, '[
  {"place":1,"players":["Mantas","Ieva","Tomas","Rūta"],"points":42,"gameDate":"10 spalio"},
  {"place":2,"players":["Darius","Gabija","Lukas"],"points":36,"gameDate":"10 spalio"},
  {"place":3,"players":["Karolis","Agnė","Paulius","Eglė"],"points":31,"gameDate":"10 spalio"}
]'::jsonb);
insert into public.all_time_winners (name, points, games_played) values ('Mantas', 184, 8), ('Ieva', 176, 8), ('Tomas', 169, 7);

commit;
