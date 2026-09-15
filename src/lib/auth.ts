"use server";

import bcrypt from "bcryptjs";
import { AppError, checkDatabase, database, publicError } from "@/lib/server/database";
import { currentUser, endSession, limitAuth, startSession } from "@/lib/server/session";
import { credentialsSchema } from "@/lib/validation";
import type { ActionResult, AppUser } from "@/lib/types";

// A dummy hash keeps unknown users on the same password-comparison path.
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function loginUser(name: string, password: string): Promise<ActionResult<AppUser>> {
  try {
    const parsed = credentialsSchema.safeParse({ name, password });
    if (!parsed.success) throw new AppError("Įrašykite 2–40 simbolių vardą ir bent 4 simbolių slaptažodį.");
    await limitAuth(parsed.data.name, false);
    const { data, error } = await database().from("users").select("id, name, password_hash, role")
      .ilike("name", parsed.data.name.replace(/[%_\\]/g, (match) => `\\${match}`)).maybeSingle();
    checkDatabase(error);
    const matches = await bcrypt.compare(parsed.data.password, data?.password_hash?.startsWith("$2") ? data.password_hash : DUMMY_HASH);
    if (!data || !data.password_hash.startsWith("$2") || !matches) throw new AppError("Neteisingas vardas arba slaptažodis.");
    await startSession(data.id);
    return { data: { id: data.id, name: data.name, role: data.role === "admin" ? "admin" : "participant" }, error: null };
  } catch (error) {
    return { data: null, error: publicError(error) };
  }
}

export async function registerUser(name: string, password: string): Promise<ActionResult<AppUser>> {
  try {
    const parsed = credentialsSchema.safeParse({ name, password });
    if (!parsed.success) throw new AppError("Įrašykite 2–40 simbolių vardą ir bent 4 simbolių slaptažodį.");
    await limitAuth(parsed.data.name, true);
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const { data, error } = await database().from("users").insert({ name: parsed.data.name, password_hash: passwordHash, role: "participant" })
      .select("id, name, role").single();
    if (error?.code === "23505") throw new AppError("Šis vardas jau užimtas.");
    checkDatabase(error);
    if (!data) throw new Error("Missing user");
    await startSession(data.id);
    return { data: { id: data.id, name: data.name, role: "participant" }, error: null };
  } catch (error) {
    return { data: null, error: publicError(error) };
  }
}

export async function getCurrentUser(): Promise<ActionResult<AppUser | null>> {
  try { return { data: await currentUser(), error: null }; }
  catch (error) { return { data: null, error: publicError(error) }; }
}

export async function logoutUser(): Promise<ActionResult<null>> {
  try { await endSession(); return { data: null, error: null }; }
  catch (error) { return { data: null, error: publicError(error) }; }
}
