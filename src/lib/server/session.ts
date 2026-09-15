import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { AppError, checkDatabase, database } from "./database";
import type { AppUser } from "@/lib/types";

const COOKIE = "auksinis-protas-session";
const MAX_AGE = 60 * 60 * 24 * 7;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = database();
  const { data: session, error } = await db.from("app_sessions")
    .select("user_id").eq("token_hash", digest(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  checkDatabase(error);
  if (!session) return null;
  const { data: user, error: userError } = await db.from("users").select("id, name, role").eq("id", session.user_id).maybeSingle();
  checkDatabase(userError);
  return user ? { id: user.id, name: user.name, role: user.role === "admin" ? "admin" : "participant" } : null;
}

export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new AppError("Prisijunkite, kad galėtumėte tęsti.");
  if (admin && user.role !== "admin") throw new AppError("Šis veiksmas skirtas tik administratoriui.");
  return user;
}

export async function startSession(userId: string) {
  await endSession();
  const token = randomBytes(32).toString("hex");
  const db = database();
  const { error: cleanupError } = await db.from("app_sessions").delete().lt("expires_at", new Date().toISOString());
  checkDatabase(cleanupError);
  const { error } = await db.from("app_sessions").insert({
    token_hash: digest(token), user_id: userId, expires_at: new Date(Date.now() + MAX_AGE * 1000).toISOString(),
  });
  checkDatabase(error);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const { error } = await database().from("app_sessions").delete().eq("token_hash", digest(token));
    checkDatabase(error);
  }
  store.delete(COOKIE);
}

export async function limitAuth(name: string, registering: boolean) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const buckets = [{ key: `ip:${ip}`, limit: registering ? 10 : 50 }];
  if (!registering) buckets.push({ key: `name:${name.toLowerCase()}`, limit: 10 });
  for (const bucket of buckets) {
    const { data, error } = await database().rpc("take_auth_attempt", {
      bucket_key: digest(`${registering ? "register" : "login"}:${bucket.key}`), max_attempts: bucket.limit,
    });
    checkDatabase(error);
    if (!data) throw new AppError("Per daug bandymų. Bandykite vėl po 15 minučių.");
  }
}
