create extension if not exists pgcrypto;

create type public.user_role as enum ('participant', 'admin');
create type public.reservation_status as enum ('active', 'cancelled', 'rejected');
create type public.event_action as enum ('reserved', 'cancelled', 'rejected');

create table public.users (
  id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 2 and 40), password_hash text not null,
  role public.user_role not null default 'participant', created_at timestamptz not null default now()
);
create table public.game_dates (
  id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, title text not null default 'Auksinis Protas',
  is_open boolean not null default true, created_at timestamptz not null default now()
);
create table public.seats (
  id uuid primary key default gen_random_uuid(), game_date_id uuid not null references public.game_dates(id) on delete cascade,
  table_number smallint not null check (table_number between 1 and 4), seat_number smallint not null check (seat_number between 1 and 4),
  unique (game_date_id, table_number, seat_number)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(), game_date_id uuid not null references public.game_dates(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete restrict, user_id uuid not null references public.users(id) on delete restrict,
  status public.reservation_status not null default 'active', reserved_at timestamptz not null default now(), cancelled_at timestamptz
);
create unique index active_reservation_per_user on public.reservations(game_date_id, user_id) where status = 'active';
create unique index active_reservation_per_seat on public.reservations(game_date_id, seat_id) where status = 'active';
create table public.reservation_events (
  id uuid primary key default gen_random_uuid(), reservation_id uuid references public.reservations(id) on delete set null,
  game_date_id uuid not null references public.game_dates(id) on delete cascade, user_name text not null,
  table_number smallint not null, seat_number smallint not null, action public.event_action not null, occurred_at timestamptz not null default now()
);

create or replace function public.create_game_date(date_time timestamptz) returns uuid language plpgsql security definer as $$
declare new_game_id uuid;
begin
  insert into public.game_dates (starts_at) values (date_time) returning id into new_game_id;
  insert into public.seats (game_date_id, table_number, seat_number)
  select new_game_id, table_number, seat_number from generate_series(1, 4) table_number cross join generate_series(1, 4) seat_number;
  return new_game_id;
end;
$$;

alter table public.users enable row level security;
alter table public.game_dates enable row level security;
alter table public.seats enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_events enable row level security;
create policy "public can view game dates" on public.game_dates for select using (true);
create policy "public can view seats" on public.seats for select using (true);