import type { Doc } from '@/lib/db/pgUtil';

/** Admin master-data collection name -> master_data.kind (allow-list). */
export const MASTER_KINDS: Record<string, string> = {
  propertyTypes: 'property_type',
  directions: 'direction',
  legalDocumentTypes: 'legal_doc_type',
  roadTypes: 'road_type',
};

export function kindOf(collection: string): string | null {
  return Object.prototype.hasOwnProperty.call(MASTER_KINDS, collection) ? MASTER_KINDS[collection] : null;
}

/** master_data row -> legacy shape: _id is the stable code (mongo_id), `order` = sort_order. */
export function masterOut(r: Doc): Doc {
  const extra = r.extra && typeof r.extra === 'object' ? r.extra : {};
  const o: Doc = { ...extra, _id: r.mongo_id, name: r.name, order: r.sort_order };
  if (r.description != null) o.description = r.description;
  if (r.type != null) o.type = r.type;
  if (Array.isArray(r.fields) && r.fields.length > 0) o.fields = r.fields;
  return o;
}
