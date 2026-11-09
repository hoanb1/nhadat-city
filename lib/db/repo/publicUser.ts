import { sql } from '../pg';
import { put, type Doc } from '../pgUtil';
import { mapRealEstateRow } from '../realEstate';

/**
 * Public view of a user (Mongo-shaped): { _id, profile{name,favorites,...}, image, emails:[{address}] }.
 * Only non-sensitive columns are read (never password_hash / oauth / login_history).
 */
export async function getPublicUserByMongoId(id: string): Promise<Doc | null> {
  const rows = await sql`
    SELECT id, mongo_id, name, email, emails, avatar_url, profile FROM users WHERE mongo_id = ${id} LIMIT 1`;
  if (!rows.length) return null;
  const r = rows[0];
  const profile: Doc = r.profile && typeof r.profile === 'object' ? { ...r.profile } : {};
  if (profile.name == null && r.name != null) profile.name = r.name;
  const d: Doc = { _id: r.mongo_id ?? String(r.id), profile };
  put(d, 'image', r.avatar_url);
  const addrs: string[] = Array.isArray(r.emails) && r.emails.length ? r.emails : r.email ? [r.email] : [];
  d.emails = addrs.map((address) => ({ address }));
  return d;
}

const PUB_COLS = sql`id, mongo_id, short_id, title, total_price, area, images[1:1] AS images, province_slug, ward_slug`;

/** Active (status = 2) listings among the given ids (favorites). */
export async function getActiveListingsByIds(ids: string[], limit = 12): Promise<Doc[]> {
  if (!ids.length) return [];
  const rows = await sql`
    SELECT ${PUB_COLS} FROM real_estates
    WHERE mongo_id IN ${sql(ids.map(String))} AND status = 2 LIMIT ${limit}`;
  return rows.map(mapRealEstateRow);
}

export async function getLatestActiveListings(limit = 8): Promise<Doc[]> {
  const rows = await sql`
    SELECT ${PUB_COLS} FROM real_estates WHERE status = 2 ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return rows.map(mapRealEstateRow);
}

/** Tag / keyword landing page listings (title/description full-text OR ward/province slug match). */
export async function getListingsByKeywordTerms(terms: string[], limit = 12): Promise<Doc[]> {
  const cols = sql`id, mongo_id, short_id, title, description, price, total_price, province_slug, ward_slug`;
  let rows;
  if (!terms.length) {
    rows = await sql`SELECT ${cols} FROM real_estates ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  } else {
    const tsq = terms.join(' or ');
    rows = await sql`
      SELECT ${cols} FROM real_estates
      WHERE search_tsv @@ websearch_to_tsquery('simple', f_unaccent(${tsq}))
         OR ward_slug IN ${sql(terms)} OR province_slug IN ${sql(terms)}
      ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  }
  return rows.map(mapRealEstateRow);
}
