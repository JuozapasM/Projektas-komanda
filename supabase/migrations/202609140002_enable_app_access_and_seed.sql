create extension if not exists pgcrypto;

-- Allow the current browser client to read and write the records it uses.
drop policy if exists "public can view users" on public.users;
drop policy if exists "public can register participants" on public.users;
create policy "public can view users" on public.users for select using (true);
create policy "public can register participants" on public.users for insert
  with check (role = 'participant');

drop policy if exists "public can view reservations" on public.reservations;
drop policy if exists "public can create active reservations" on public.reservations;
drop policy if exists "public can cancel reservations" on public.reservations;
create policy "public can view reservations" on public.reservations for select using (true);
create policy "public can create active reservations" on public.reservations for insert
  with check (status = 'active');
create policy "public can cancel reservations" on public.reservations for update
  using (true) with check (status in ('active', 'cancelled'));

drop policy if exists "public can view reservation events" on public.reservation_events;
drop policy if exists "public can write reservation events" on public.reservation_events;
create policy "public can view reservation events" on public.reservation_events for select using (true);
create policy "public can write reservation events" on public.reservation_events for insert with check (true);

insert into public.users (name, password_hash, role)
select 'Laima', '$2b$10$V2GD1/CRykrha3K1jYoNeOv6fFwQtEKF5pr48egIO5F1LLm2Uafmm', 'admin'
where not exists (
  select 1 from public.users where lower(name) = lower('Laima')
);

do $$
declare
  game_id uuid;
  game_start timestamptz;
begin
  foreach game_start in array array[
    '2026-10-10 19:00:00+03'::timestamptz,
    '2026-10-17 19:00:00+03'::timestamptz,
    '2026-10-24 19:00:00+03'::timestamptz
  ] loop
    select id into game_id
    from public.game_dates
    where starts_at = game_start
    limit 1;

    if game_id is null then
      insert into public.game_dates (starts_at, title)
      values (game_start, 'Auksinis Protas')
      returning id into game_id;
    end if;

    insert into public.seats (game_date_id, table_number, seat_number)
    select game_id, table_number, seat_number
    from generate_series(1, 4) as table_number
    cross join generate_series(1, 4) as seat_number
    on conflict (game_date_id, table_number, seat_number) do nothing;

    game_id := null;
  end loop;
end;
$$;