import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const name = (process.env.ADMIN_NAME ?? 'Laima').trim().replace(/\s+/g, ' ');
const password = process.env.ADMIN_PASSWORD ?? '';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.includes('your-project') || key.includes('your-service-role-key')) throw new Error('Įrašykite Supabase URL ir serverio service role raktą į .env.local.');
if (name.length < 2 || name.length > 40 || password.length < 12 || Buffer.byteLength(password) > 72 || password.includes('your-admin-password')) {
  throw new Error('ADMIN_NAME turi būti 2–40 simbolių, ADMIN_PASSWORD — bent 12 simbolių ir daugiausiai 72 baitų.');
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: readError } = await db.from('users').select('id, role')
  .ilike('name', name.replace(/[%_\\]/g, (match) => `\\${match}`)).maybeSingle();
if (readError) throw new Error('Nepavyko patikrinti administratoriaus. Patikrinkite Supabase nustatymus.');
if (existing && existing.role !== 'admin') throw new Error('Šį vardą jau naudoja dalyvis. Pasirinkite kitą administratoriaus vardą.');
const passwordHash = await bcrypt.hash(password, 12);
// Revoke existing sessions before changing an administrator credential.
if (existing) {
  const { error } = await db.from('app_sessions').delete().eq('user_id', existing.id);
  if (error) throw new Error('Nepavyko atšaukti senų sesijų. Pirmiausia pritaikykite naują migraciją.');
}
const result = existing
  ? await db.from('users').update({ name, password_hash: passwordHash }).eq('id', existing.id)
  : await db.from('users').insert({ name, password_hash: passwordHash, role: 'admin' });
if (result.error) throw new Error('Nepavyko nustatyti administratoriaus. Patikrinkite migracijas ir vardą.');
console.log('Administratoriaus paskyra paruošta. Slaptažodis neskelbiamas.');
