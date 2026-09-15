"use server";

import { AppError, checkDatabase, database, publicError } from "@/lib/server/database";
import { requireUser } from "@/lib/server/session";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult, Seat } from "@/lib/types";

export async function loadSeatBoard(gameDateId: string): Promise<ActionResult<Seat[]>> {
  try {
    const user = await requireUser();
    if (!uuidSchema.safeParse(gameDateId).success) throw new AppError("Pasirinkite žaidimo datą.");
    const { data, error } = await database().from("seats")
      .select("id, table_number, seat_number, reservations(user_id, status, users(name))").eq("game_date_id", gameDateId).order("table_number").order("seat_number");
    checkDatabase(error);
    return { data: (data ?? []).map((seat) => {
      const rows = seat.reservations as unknown as { user_id: string; status: string; users: { name: string } | null }[];
      const active = rows.find((row) => row.status === "active");
      return { id: seat.id, tableNumber: seat.table_number, seatNumber: seat.seat_number, occupant: active?.users?.name,
        status: active ? active.user_id === user.id ? "mine" : "occupied" : "free" };
    }), error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function reserveSeatForUser(gameDateId: string): Promise<ActionResult<Seat>> {
  try {
    const user = await requireUser();
    if (!uuidSchema.safeParse(gameDateId).success) throw new AppError("Pasirinkite žaidimo datą.");
    const { data, error } = await database().rpc("reserve_game_seat", { actor_id: user.id, game_id: gameDateId });
    if (error?.code === "23505") throw new AppError("Jau turite rezervaciją šiam žaidimui.");
    if (error?.message === "GAME_CLOSED") throw new AppError("Šio žaidimo rezervacija uždaryta.");
    if (error?.message === "NO_SEATS") throw new AppError("Šiai datai laisvų vietų nebėra.");
    checkDatabase(error);
    if (!data) throw new Error("Missing seat");
    return { data: { id: data.id, tableNumber: data.table_number, seatNumber: data.seat_number, occupant: user.name, status: "mine" }, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function cancelSeatForUser(gameDateId: string): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    if (!uuidSchema.safeParse(gameDateId).success) throw new AppError("Pasirinkite žaidimo datą.");
    const { error } = await database().rpc("cancel_game_seat", { actor_id: user.id, game_id: gameDateId });
    if (error?.message === "NOT_FOUND") throw new AppError("Rezervacijos nerasta.");
    checkDatabase(error);
    return { data: null, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function rejectReservation(reservationId: string): Promise<ActionResult<null>> {
  try {
    const user = await requireUser(true);
    if (!uuidSchema.safeParse(reservationId).success) throw new AppError("Rezervacijos nerasta.");
    const { error } = await database().rpc("reject_game_reservation", { actor_id: user.id, reservation_id: reservationId });
    if (error?.message === "NOT_FOUND") throw new AppError("Rezervacija jau atšaukta arba atmesta.");
    checkDatabase(error);
    return { data: null, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}
