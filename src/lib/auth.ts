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

function escapeLikePattern(value: string) {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

function normalizeStoredUsers(users: unknown): StoredUser[] {
  if (!Array.isArray(users)) return [];

  return users.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const record = entry as Partial<StoredUser> & { password_hash?: string };
    const name = normalizeName(typeof record.name === "string" ? record.name : "");
    const passwordHash = typeof record.passwordHash === "string" ? record.passwordHash : record.password_hash ?? "";
    const role = record.role === "admin" ? "admin" : "participant";

    if (!name || !passwordHash) return [];

    return [{
      id: typeof record.id === "string" ? record.id : undefined,
      name,
      passwordHash,
      role,
    }];
  });
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
    if (!saved) return [];

    const parsed = JSON.parse(saved) as unknown;
    const users = normalizeStoredUsers(parsed);

    if (users.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
      writeStoredUsers(users);
    }

    return users;
  } catch {
    window.localStorage.removeItem(USERS_KEY);
    return [];
  }
}

function writeStoredUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users.map((user) => ({
    ...user,
    name: normalizeName(user.name),
  }))));
}

function ensureSeededUsers() {
  const users = readStoredUsers();

  if (users.some((user) => normalizeName(user.name).toLowerCase() === "laima")) return users;

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
        .ilike("name", escapeLikePattern(normalizedName))
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
        .ilike("name", escapeLikePattern(normalizedName))
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
