import { createClient } from "@/lib/supabase/client";
import { createSeats } from "@/lib/mock-data";
import type { Seat } from "@/lib/types";

const LOCAL_STORAGE_PREFIX = "auksinis-protas-seats";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeLikePattern(value: string) {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

function getSeatBoardStorageKey(gameDateId: string) {
  return `${LOCAL_STORAGE_PREFIX}-${gameDateId}`;
}

function readLocalSeatBoard(gameDateId: string): Seat[] {
  if (typeof window === "undefined") return createSeats();

  try {
    const saved = window.localStorage.getItem(getSeatBoardStorageKey(gameDateId));
    if (!saved) return createSeats();

    const parsed = JSON.parse(saved) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Seat[];
  } catch {
    // Ignore invalid saved state and fall back to generated seats.
  }

  return createSeats();
}

function writeLocalSeatBoard(gameDateId: string, seats: Seat[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getSeatBoardStorageKey(gameDateId), JSON.stringify(seats));
}

export function hasSupabaseConfig() {
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

export async function loadSeatBoard(gameDateId: string, userName: string): Promise<Seat[]> {
  if (!hasSupabaseConfig()) {
    const seats = readLocalSeatBoard(gameDateId);
    return seats.map((seat) => ({
      ...seat,
      status: seat.occupant && userName && seat.occupant.toLowerCase() === normalizeName(userName).toLowerCase() ? "mine" : seat.occupant ? "occupied" : "free",
    }));
  }

  const client = createClient();
  const { data: seatRows, error: seatError } = await client
    .from("seats")
    .select("id, table_number, seat_number")
    .eq("game_date_id", gameDateId)
    .order("table_number", { ascending: true })
    .order("seat_number", { ascending: true });

  if (seatError || !seatRows) return createSeats();

  const { data: reservationRows, error: reservationError } = await client
    .from("reservations")
    .select("seat_id, user_id, status")
    .eq("game_date_id", gameDateId)
    .eq("status", "active");

  if (reservationError) return createSeats();

  const userIds = [...new Set((reservationRows ?? []).map((row) => row.user_id))];
  const occupantBySeat = new Map<string, string>();

  if (userIds.length) {
    const { data: usersRows } = await client
      .from("users")
      .select("id, name")
      .in("id", userIds);

    const occupantMap = new Map((usersRows ?? []).map((user) => [user.id, user.name]));

    for (const row of reservationRows ?? []) {
      const occupant = occupantMap.get(row.user_id);
      if (occupant) occupantBySeat.set(row.seat_id, occupant);
    }
  }

  return seatRows.map((seat) => {
    const occupant = occupantBySeat.get(seat.id);
    const isMine = Boolean(occupant && userName && occupant.toLowerCase() === normalizeName(userName).toLowerCase());

    return {
      id: seat.id,
      tableNumber: seat.table_number,
      seatNumber: seat.seat_number,
      occupant: occupant ?? undefined,
      status: isMine ? "mine" : occupant ? "occupied" : "free",
    };
  });
}

export async function reserveSeatForUser(gameDateId: string, userName: string) {
  const normalizedUserName = normalizeName(userName);

  if (!hasSupabaseConfig()) {
    const seats = readLocalSeatBoard(gameDateId);
    const existingSeat = seats.find((seat) => seat.occupant && seat.occupant.toLowerCase() === normalizedUserName.toLowerCase());

    if (existingSeat) {
      return { error: "Jau turite rezervaciją šiam žaidimui." };
    }

    const chosenSeat = seats.find((seat) => seat.status === "free");
    if (!chosenSeat) {
      return { error: "Šiai datai laisvų vietų nebėra." };
    }

    const nextSeats: Seat[] = seats.map((seat) =>
      seat.id === chosenSeat.id
        ? { ...seat, occupant: normalizedUserName, status: "mine" }
        : { ...seat, status: seat.occupant ? "occupied" : "free" },
    );

    writeLocalSeatBoard(gameDateId, nextSeats);

    return {
      seat: {
        id: chosenSeat.id,
        tableNumber: chosenSeat.tableNumber,
        seatNumber: chosenSeat.seatNumber,
        occupant: normalizedUserName,
        status: "mine",
      },
    };
  }

  const client = createClient();

  const { data: userRow, error: userError } = await client
    .from("users")
    .select("id, name")
    .ilike("name", escapeLikePattern(normalizedUserName))
    .maybeSingle();

  if (userError || !userRow) {
    return { error: "Vartotojas nerastas." };
  }

  const { data: existing } = await client
    .from("reservations")
    .select("id")
    .eq("game_date_id", gameDateId)
    .eq("user_id", userRow.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return { error: "Jau turite rezervaciją šiam žaidimui." };
  }

  const { data: seatRows } = await client
    .from("seats")
    .select("id, table_number, seat_number")
    .eq("game_date_id", gameDateId)
    .order("table_number", { ascending: true })
    .order("seat_number", { ascending: true });

  const { data: activeReservations } = await client
    .from("reservations")
    .select("seat_id")
    .eq("game_date_id", gameDateId)
    .eq("status", "active");

  const takenSeatIds = new Set((activeReservations ?? []).map((reservation) => reservation.seat_id));
  const chosenSeat = (seatRows ?? []).find((seat) => !takenSeatIds.has(seat.id));

  if (!chosenSeat) {
    return { error: "Šiai datai laisvų vietų nebėra." };
  }

  const { error: reservationError } = await client
    .from("reservations")
    .insert({
      game_date_id: gameDateId,
      seat_id: chosenSeat.id,
      user_id: userRow.id,
      status: "active",
    });

  if (reservationError) {
    return { error: reservationError.message || "Nepavyko sukurti rezervacijos." };
  }

  await client.from("reservation_events").insert({
    game_date_id: gameDateId,
    user_name: userRow.name,
    table_number: chosenSeat.table_number,
    seat_number: chosenSeat.seat_number,
    action: "reserved",
  });

  return {
    seat: {
      id: chosenSeat.id,
      tableNumber: chosenSeat.table_number,
      seatNumber: chosenSeat.seat_number,
      occupant: userRow.name,
      status: "mine",
    },
  };
}

export async function cancelSeatForUser(gameDateId: string, userName: string) {
  const normalizedUserName = normalizeName(userName);

  if (!hasSupabaseConfig()) {
    const seats = readLocalSeatBoard(gameDateId);
    const targetSeat = seats.find((seat) => seat.occupant && seat.occupant.toLowerCase() === normalizedUserName.toLowerCase());

    if (!targetSeat) {
      return { ok: false, error: "Rezervacijos nerasta." };
    }

    const nextSeats: Seat[] = seats.map((seat) =>
      seat.id === targetSeat.id
        ? { ...seat, occupant: undefined, status: "free" }
        : { ...seat, status: seat.occupant ? "occupied" : "free" },
    );

    writeLocalSeatBoard(gameDateId, nextSeats);
    return { ok: true };
  }

  const client = createClient();

  const { data: userRow, error: userError } = await client
    .from("users")
    .select("id, name")
    .ilike("name", escapeLikePattern(normalizedUserName))
    .maybeSingle();

  if (userError || !userRow) {
    return { ok: false, error: "Vartotojas nerastas." };
  }

  const { data: reservationRow, error: reservationError } = await client
    .from("reservations")
    .select("id, seat_id")
    .eq("game_date_id", gameDateId)
    .eq("user_id", userRow.id)
    .eq("status", "active")
    .maybeSingle();

  if (reservationError || !reservationRow) {
    return { ok: false, error: "Rezervacijos nerasta." };
  }

  const { error: updateError } = await client
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", reservationRow.id);

  if (updateError) {
    return { ok: false, error: updateError.message || "Nepavyko atšaukti rezervacijos." };
  }

  const { data: seatRow } = await client
    .from("seats")
    .select("table_number, seat_number")
    .eq("id", reservationRow.seat_id)
    .maybeSingle();

  await client.from("reservation_events").insert({
    game_date_id: gameDateId,
    user_name: userRow.name,
    table_number: seatRow?.table_number ?? 0,
    seat_number: seatRow?.seat_number ?? 0,
    action: "cancelled",
  });

  return { ok: true };
}

export async function rejectReservation(reservationId: string) {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Atmesti galima tik prijungus Supabase." };
  }

  const client = createClient();

  const { data: reservationRow, error: reservationError } = await client
    .from("reservations")
    .select("id, game_date_id, seat_id, user_id, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError || !reservationRow) {
    return { ok: false, error: "Rezervacijos nerasta." };
  }

  if (reservationRow.status !== "active") {
    return { ok: false, error: "Rezervacija jau atšaukta arba atmesta." };
  }

  const { error: updateError } = await client
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", reservationId);

  if (updateError) {
    return { ok: false, error: updateError.message || "Nepavyko atmesti rezervacijos." };
  }

  const { data: userRow } = await client.from("users").select("name").eq("id", reservationRow.user_id).maybeSingle();
  const { data: seatRow } = await client
    .from("seats")
    .select("table_number, seat_number")
    .eq("id", reservationRow.seat_id)
    .maybeSingle();

  await client.from("reservation_events").insert({
    reservation_id: reservationId,
    game_date_id: reservationRow.game_date_id,
    user_name: userRow?.name ?? "Nežinomas",
    table_number: seatRow?.table_number ?? 0,
    seat_number: seatRow?.seat_number ?? 0,
    action: "rejected",
  });

  return { ok: true };
}
