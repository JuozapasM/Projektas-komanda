"use server";

import { checkDatabase, database, publicError } from "@/lib/server/database";
import { requireUser } from "@/lib/server/session";
import { GAME_CAPACITY } from "@/lib/constants";
import type { ActionResult, GameDate, ReservationEvent } from "@/lib/types";

const RESERVATION_EVENT_LIMIT = 100;
const RESERVATION_EVENT_RETENTION_MONTHS = 3;

function reservationEventCutoff(now = new Date()) {
  const cutoff = new Date(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RESERVATION_EVENT_RETENTION_MONTHS);
  const lastDayOfMonth = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDayOfMonth));
  return cutoff.toISOString();
}

function formatGameDate(value: string) {
  const date = new Date(value);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("lt-LT", { ...options, timeZone: "Europe/Vilnius" }).format(date);
  return { label: format({ month: "long", day: "numeric" }), day: format({ weekday: "short" }).toUpperCase(),
    date: format({ day: "2-digit", month: "short" }).toUpperCase(), time: format({ hour: "2-digit", minute: "2-digit", hour12: false }) };
}

export async function getGameDates(): Promise<ActionResult<GameDate[]>> {
  try {
    await requireUser();
    const db = database();
    const { data, error } = await db.from("game_dates").select("id, title, starts_at").eq("is_open", true).order("starts_at");
    checkDatabase(error);
    const { data: reservations, error: reservationError } = await db.from("reservations").select("game_date_id").eq("status", "active");
    checkDatabase(reservationError);
    const occupied = new Map<string, number>();
    for (const row of reservations ?? []) occupied.set(row.game_date_id, (occupied.get(row.game_date_id) ?? 0) + 1);
    return { data: (data ?? []).map((game) => ({ id: game.id, ...formatGameDate(game.starts_at),
      label: game.title || formatGameDate(game.starts_at).label, seatsLeft: Math.max(0, GAME_CAPACITY - (occupied.get(game.id) ?? 0)) })), error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function getReservationEvents(): Promise<ActionResult<ReservationEvent[]>> {
  try {
    await requireUser(true);
    const db = database();
    const { error: cleanupError } = await db.from("reservation_events").delete().lt("occurred_at", reservationEventCutoff());
    checkDatabase(cleanupError);
    const { data, error } = await db.from("reservation_events")
      .select("id, action, user_name, table_number, seat_number, occurred_at, reservation_id, game_dates(starts_at), reservations(status)")
      .order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(RESERVATION_EVENT_LIMIT);
    checkDatabase(error);
    return { data: (data ?? []).map((event) => {
      const game = event.game_dates as unknown as { starts_at: string } | null;
      const reservation = event.reservations as unknown as { status: string } | null;
      return { id: event.id, action: event.action === "cancelled" ? "Atšaukimas" : event.action === "rejected" ? "Atmesta" : "Rezervacija",
        user: event.user_name, seat: `${event.table_number} stalas / ${event.seat_number} vieta`,
        date: formatGameDate(game?.starts_at ?? event.occurred_at).date,
        time: new Intl.DateTimeFormat("lt-LT", { timeZone: "Europe/Vilnius", dateStyle: "short", timeStyle: "medium" }).format(new Date(event.occurred_at)),
        reservationId: event.reservation_id ?? undefined, rejectable: event.action === "reserved" && reservation?.status === "active" };
    }), error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function getOnlineCount(): Promise<ActionResult<number>> {
  try {
    await requireUser(true);
    const { data, error } = await database().from("app_sessions").select("user_id").gt("expires_at", new Date().toISOString());
    checkDatabase(error);
    return { data: new Set((data ?? []).map((session) => session.user_id)).size, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}
