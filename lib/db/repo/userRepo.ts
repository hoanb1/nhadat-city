/**
 * Postgres access for the `users` table (replaces Mongo `users` collection).
 *
 * Identity rule: the "user id" exposed to sessions / JWT / URLs is
 *   mongo_id ?? String(id)
 * so existing Meteor/Mongo ids keep working. New users get a Meteor-style
 * 17-char mongo_id so every `*_mongo_id` column joins uniformly.
 *
 * Password rule (unchanged from Mongo): bcrypt( sha256hex(password) ), stored in users.password_hash.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db/pg';
import type { Doc } from '@/lib/db/pgUtil';

export interface UserRow extends Doc {
  id: number | string;
  mongo_id: string | null;
  short_id: string | null;
  username: string | null;
  email: string | null;
  emails: string[] | null;
  password_hash: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: string[] | null;
  google_id: string | null;
  profile: Doc | null;
  extra: Doc | null;
}

const USER_COLS = sql`id, mongo_id, short_id, username, email, emails, password_hash, name, phone,
  avatar_url, roles, google_id, profile, extra`;

/** Public string id of a user row (what sessions / links use). */
export function userIdOf(u: { id: number | string; mongo_id?: string | null }): string {
  return u.mongo_id ?? String(u.id);
}

export function isAdminRole(roles: string[] | null | undefined): boolean {
  return !!roles && (roles.includes('admin') || roles.includes('super-admin'));
}

/** Display name: profile.name, else name column, else username. */
export function userDisplayName(u: UserRow): string | null {
  return (u.profile?.name as string | undefined) || u.name || u.username || null;
}

// ---- password helpers (Meteor style) --------------------------------------

export function sha256Hex(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

/** True when `plain` matches a Meteor-style hash (bcrypt of sha256 hex). Never throws. */
export function verifyPassword(plain: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(sha256Hex(plain), hash);
  } catch {
    return false;
  }
}

/** Hash that verifyPassword() (and the legacy Meteor login) accepts. */
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(sha256Hex(plain), 10);
}

// ---- lookups ---------------------------------------------------------------

/** Find by public id: mongo_id, else numeric PK for natively-created rows without mongo_id. */
export async function findUserById(id: string): Promise<UserRow | null> {
  if (!id) return null;
  let rows = await sql<UserRow[]>`SELECT ${USER_COLS} FROM users WHERE mongo_id = ${id} LIMIT 1`;
  if (!rows.length && /^\d{1,15}$/.test(id)) {
    rows = await sql<UserRow[]>`SELECT ${USER_COLS} FROM users WHERE mongo_id IS NULL AND id = ${Number(id)} LIMIT 1`;
  }
  return rows[0] ?? null;
}

export async function findUserByShortId(shortId: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`SELECT ${USER_COLS} FROM users WHERE short_id = ${shortId} LIMIT 1`;
  return rows[0] ?? null;
}

/** Match primary email or any address in emails[] (Meteor `emails.address`). */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const e = (email || '').toLowerCase();
  if (!e) return null;
  const rows = await sql<UserRow[]>`
    SELECT ${USER_COLS} FROM users
    WHERE email = ${e} OR emails @> ARRAY[${e}]::citext[]
    ORDER BY (email = ${e}) DESC NULLS LAST
    LIMIT 1`;
  return rows[0] ?? null;
}

/** Numeric PK for a public user id (used for FKs); null when not found. */
export async function resolveUserPk(publicId: string): Promise<number | null> {
  const u = await findUserById(publicId);
  return u ? Number(u.id) : null;
}

// ---- writes ----------------------------------------------------------------

function meteorId(len = 17): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}

/** Create a verified Google-backed user (role user). Returns the row (existing one on email race). */
export async function createGoogleUser(shortId: string, g: GoogleProfile): Promise<UserRow> {
  const email = g.email.toLowerCase();
  const oauth = { google: { id: g.googleId, email, name: g.name ?? null, picture: g.picture ?? null } };
  const profile = { name: g.name ?? null, avatar: g.picture ?? null };
  const mongoId = meteorId();
  const insert = (googleId: string | null) => sql<UserRow[]>`
    INSERT INTO users (mongo_id, short_id, email, email_verified, emails, name, avatar_url, roles,
                       google_id, oauth, profile, created_at)
    VALUES (${mongoId}, ${shortId}, ${email}, TRUE, ARRAY[${email}]::citext[], ${g.name ?? null},
            ${g.picture ?? null}, ARRAY['user'], ${googleId}, ${sql.json(oauth)}, ${sql.json(profile)}, NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING ${USER_COLS}`;
  let rows: UserRow[];
  try {
    rows = await insert(g.googleId);
  } catch (e: any) {
    if (e?.code === '23505') rows = await insert(null); // google_id already used by another row
    else throw e;
  }
  if (rows.length) return rows[0];
  const existing = await findUserByEmail(email);
  if (!existing) throw new Error('createGoogleUser: insert conflict but user not found');
  return existing;
}

/** Link Google identity to an existing user that has none. */
export async function linkGoogle(userPk: number | string, g: GoogleProfile): Promise<void> {
  const email = g.email.toLowerCase();
  const google = { id: g.googleId, email, name: g.name ?? null, picture: g.picture ?? null };
  try {
    await sql`UPDATE users SET google_id = COALESCE(google_id, ${g.googleId}),
      oauth = oauth || ${sql.json({ google })}, updated_at = NOW() WHERE id = ${userPk}`;
  } catch (e: any) {
    if (e?.code !== '23505') throw e;
    // google_id belongs to another row: keep oauth info only
    await sql`UPDATE users SET oauth = oauth || ${sql.json({ google })}, updated_at = NOW() WHERE id = ${userPk}`;
  }
}

/** Merge keys into users.profile (jsonb). */
export async function mergeProfile(userPk: number | string, patch: Doc): Promise<void> {
  await sql`UPDATE users SET profile = profile || ${sql.json(patch)}, updated_at = NOW() WHERE id = ${userPk}`;
}

export async function setPasswordHash(userPk: number | string, hash: string): Promise<void> {
  await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userPk}`;
}
