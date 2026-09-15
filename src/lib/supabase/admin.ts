"use server";

import { AppError, checkDatabase, database, publicError } from "@/lib/server/database";
import { requireUser } from "@/lib/server/session";
import type { ActionResult } from "@/lib/types";

export async function createGameDate(startsAt: string): Promise<ActionResult<null>> {
  try {
    const user = await requireUser(true);
    if (typeof startsAt !== "string" || !Number.isFinite(Date.parse(startsAt))) throw new AppError("Įrašykite tinkamą datą ir laiką.");
    const { error } = await database().rpc("create_game_date_secure", { actor_id: user.id, date_time: new Date(startsAt).toISOString() });
    checkDatabase(error);
    return { data: null, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}
