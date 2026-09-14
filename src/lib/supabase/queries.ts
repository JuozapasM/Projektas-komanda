import { createClient } from "@/lib/supabase/client";
import { gameDates as fallbackGameDates, reservationEvents as fallbackReservationEvents } from "@/lib/mock-data";
import type { GameDate, ReservationEvent } from "@/lib/types";

function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return Boolean(
    url &&
    key &&
    !url.includes("example") &&
    !url.includes("your-project") &&
    !key.includes("example") &&
    !key.includes("your-anon-key")
  );
}

function formatGameDate(dateValue: string) {
  const date = new Date(dateValue);

  return {
    label: new Intl.DateTimeFormat("lt-LT", { month: "long", day: "numeric" }).format(date),
    day: new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).toUpperCase(),
    date: new Intl.DateTimeFormat("lt-LT", { day: "2-digit", month: "short" }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date),
  };
}

export async function getGameDates(): Promise<GameDate[]> {
  if (!hasSupabaseConfig()) return fallbackGameDates;

  const client = createClient();
  const { data, error } = await client
    .from("game_dates")
    .select("id, title, starts_at, is_open")
    .eq("is_open", true)
    .order("starts_at", { ascending: true });

  if (error || !data) return fallbackGameDates;

  return data.map((game) => {
    const dateInfo = formatGameDate(game.starts_at as string);

    return {
      id: game.id,
      label: game.title || dateInfo.label,
      day: dateInfo.day,
      date: dateInfo.date,
      time: dateInfo.time,
      seatsLeft: 16,
    };
  });
}

export async function getReservationEvents(): Promise<ReservationEvent[]> {
  if (!hasSupabaseConfig()) return fallbackReservationEvents;

  const client = createClient();
  const { data, error } = await client
    .from("reservation_events")
    .select("id, action, user_name, table_number, seat_number, occurred_at")
    .order("occurred_at", { ascending: false });

  if (error || !data) return fallbackReservationEvents;

  return data.map((event) => {
    const action = event.action === "cancelled" ? "Atšaukimas" : "Rezervacija";
    const dateInfo = formatGameDate(event.occurred_at as string);

    return {
      id: event.id,
      action,
      user: event.user_name,
      seat: `${event.table_number} stalas / ${event.seat_number} vieta`,
      date: dateInfo.date,
      time: `${dateInfo.time}`,
    };
  });
}
