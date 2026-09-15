import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localDatabase } from "./local-database.mjs";

export class AppError extends Error {}

export function database(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !key && process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    return localDatabase();
  }
  if (!url || !key || url.includes("your-project") || key.includes("your-service-role-key")) {
    throw new AppError("Sistema dar neparuošta. Susisiekite su organizatoriumi.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function publicError(error: unknown) {
  return error instanceof AppError ? error.message : "Nepavyko atlikti veiksmo. Bandykite dar kartą.";
}

export function checkDatabase(error: unknown) {
  if (error) throw new Error("Database operation failed");
}
