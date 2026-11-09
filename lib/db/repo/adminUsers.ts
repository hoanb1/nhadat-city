import type { Doc } from '@/lib/db/pgUtil';

/** users row (no secrets selected) -> legacy Meteor-shaped user doc used by admin-ui. */
export function userOut(r: Doc): Doc {
  const emails: string[] = Array.isArray(r.emails) && r.emails.length ? r.emails : r.email ? [r.email] : [];
  const profile: Doc = { ...(r.profile && typeof r.profile === 'object' ? r.profile : {}) };
  if (r.name != null) profile.name = r.name;
  if (r.phone != null) profile.phone = r.phone;
  if (r.address != null) profile.address = r.address;
  if (r.avatar_url != null) profile.avatar = r.avatar_url;
  const o: Doc = {
    _id: r.mongo_id ?? String(r.id),
    createdAt: r.created_at,
    emails: emails.map((address, i) => ({ address, verified: i === 0 ? !!r.email_verified : false })),
    profile,
    roles: r.roles ?? [],
  };
  if (r.username != null) o.username = r.username;
  return o;
}


