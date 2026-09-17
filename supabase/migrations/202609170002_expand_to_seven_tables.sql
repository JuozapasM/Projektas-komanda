begin;

alter table public.seats drop constraint seats_table_number_check;
alter table public.seats add constraint seats_table_number_check check (table_number between 1 and 7);

-- Preserve every existing seat and reservation while adding tables 5–7 to all games.
insert into public.seats (game_date_id, table_number, seat_number)
select game.id, table_number, seat_number
from public.game_dates game
cross join generate_series(5, 7) table_number
cross join generate_series(1, 4) seat_number
on conflict (game_date_id, table_number, seat_number) do nothing;

create or replace function public.create_game_date_secure(actor_id uuid, date_time timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_game_id uuid;
begin
  if not exists (select 1 from public.users where id = actor_id and role = 'admin') then
    raise exception 'FORBIDDEN';
  end if;
  if date_time is null then raise exception 'INVALID_DATE'; end if;
  insert into public.game_dates (starts_at) values (date_time) returning id into new_game_id;
  insert into public.seats (game_date_id, table_number, seat_number)
  select new_game_id, table_number, seat_number
  from generate_series(1, 7) table_number
  cross join generate_series(1, 4) seat_number;
  return new_game_id;
end;
$$;

revoke all on function public.create_game_date_secure(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_game_date_secure(uuid, timestamptz) to service_role;

commit;
