import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/client";

const USERS_KEY = "auksinis-protas-users";

export type AppUser = {
  name: string;
  role: "participant" | "admin";
};

type StoredUser = {
  id?: string;
  name: string;
  passwordHash: string;
  role: "participant" | "admin";
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

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

function readStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(USERS_KEY);
    return saved ? (JSON.parse(saved) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeStoredUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function ensureSeededUsers() {
  const users = readStoredUsers();

  if (users.some((user) => user.name.toLowerCase() === "laima")) return users;

  const seeded: StoredUser[] = [
    ...users,
    { name: "Laima", passwordHash: bcrypt.hashSync("laima26", 10), role: "admin" },
  ];

  writeStoredUsers(seeded);
  return seeded;
}

export async function loginUser(name: string, password: string): Promise<AppUser | null> {
  const normalizedName = normalizeName(name);
  if (!normalizedName || password.length < 4) return null;

  if (hasSupabaseConfig()) {
    try {
      const client = createClient();
      const { data, error } = await client
        .from("users")
        .select("name, password_hash, role")
        .eq("name", normalizedName)
        .maybeSingle();

      if (!error && data && bcrypt.compareSync(password, data.password_hash)) {
        return { name: data.name, role: data.role === "admin" ? "admin" : "participant" };
      }
    } catch {
      // Falls back below when Supabase is unavailable or tables are not ready yet.
    }
  }

  const users = ensureSeededUsers();
  const user = users.find((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return null;

  return { name: user.name, role: user.role };
}

export async function registerUser(name: string, password: string): Promise<AppUser | null> {
  const normalizedName = normalizeName(name);
  if (!normalizedName || password.length < 4) return null;

  if (hasSupabaseConfig()) {
    try {
      const client = createClient();
      const { data, error } = await client
        .from("users")
        .select("name")
        .eq("name", normalizedName)
        .maybeSingle();

      if (!error && data) return null;

      const passwordHash = bcrypt.hashSync(password, 10);
      const { error: insertError } = await client
        .from("users")
        .insert({ name: normalizedName, password_hash: passwordHash, role: "participant" });

      if (!insertError) {
        return { name: normalizedName, role: "participant" };
      }
    } catch {
      // Fallback below when Supabase is not configured or the schema is not available.
    }
  }

  const users = ensureSeededUsers();
  const existing = users.find((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());

  if (existing) return null;

  const nextUsers = [
    ...users,
    { name: normalizedName, passwordHash: bcrypt.hashSync(password, 10), role: "participant" as const },
  ];

  writeStoredUsers(nextUsers);
  return { name: normalizedName, role: "participant" };
}
