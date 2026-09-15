"use server";

import { AppError, checkDatabase, database, publicError } from "@/lib/server/database";
import { requireUser } from "@/lib/server/session";
import { winnersSchema } from "@/lib/validation";
import type { ActionResult, AllTimeWinner, WinnerTeam } from "@/lib/types";

export async function getWinners(): Promise<ActionResult<{ winners: WinnerTeam[]; allTime: AllTimeWinner[] }>> {
  try {
    const { data, error } = await database().from("winner_results").select("teams").eq("id", 1).maybeSingle();
    checkDatabase(error);
    const parsed = winnersSchema.safeParse(data?.teams);
    if (data && !parsed.success) throw new Error("Invalid winner results");
    const { data: allTime, error: allTimeError } = await database().from("all_time_winners").select("name, points, games_played").order("points", { ascending: false }).limit(3);
    checkDatabase(allTimeError);
    return { data: { winners: parsed.success ? parsed.data.map((team) => ({ ...team, players: team.players.filter(Boolean) })).sort((a,b) => a.place - b.place) : [],
      allTime: (allTime ?? []).map((row) => ({ name: row.name, points: row.points, gamesPlayed: row.games_played })) }, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}

export async function saveWinnerResults(winners: WinnerTeam[]): Promise<ActionResult<WinnerTeam[]>> {
  try {
    await requireUser(true);
    const parsed = winnersSchema.safeParse(winners);
    if (!parsed.success) throw new AppError("Patikrinkite žaidėjų vardus ir taškus. Taškai turi būti neneigiami sveikieji skaičiai.");
    const teams = parsed.data.map((team) => ({ ...team, players: team.players.filter(Boolean) })).sort((a,b) => a.place - b.place);
    const { error } = await database().from("winner_results").upsert({ id: 1, teams, updated_at: new Date().toISOString() });
    checkDatabase(error);
    return { data: teams, error: null };
  } catch (error) { return { data: null, error: publicError(error) }; }
}
