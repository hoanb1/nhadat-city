import type { Doc } from '@/lib/db/pgUtil';

/** emails row -> legacy shape (`from`/`to` arrays of {address,name}, messageId, syncedAt). */
export function emailOut(r: Doc): Doc {
  const extra = r.extra && typeof r.extra === 'object' ? r.extra : {};
  const o: Doc = { ...extra, _id: r.mongo_id ?? String(r.id) };
  o.folder = r.folder;
  o.uid = Number(r.uid);
  if (r.message_id != null) o.messageId = r.message_id;
  o.subject = r.subject;
  o.from = r.from_addrs ?? [];
  o.to = r.to_addrs ?? [];
  o.date = r.date;
  if (r.text !== undefined) o.text = r.text;
  if (r.html !== undefined) o.html = r.html;
  if (r.synced_at != null) o.syncedAt = r.synced_at;
  return o;
}
