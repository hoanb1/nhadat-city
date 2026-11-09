import type { Doc } from '@/lib/db/pgUtil';

/**
 * campaigns row -> legacy shape. Mongo kept all fields nested under `name.*`
 * (admin-ui reads item.name?.name / .description / .location / .startDate / .endDate / .status).
 */
export function campaignOut(r: Doc): Doc {
  const extra = r.extra && typeof r.extra === 'object' ? r.extra : {};
  return {
    ...extra,
    _id: r.mongo_id ?? String(r.id),
    name: {
      name: r.name ?? '',
      description: r.description ?? '',
      location: r.location ?? '',
      startDate: r.start_date ?? '',
      endDate: r.end_date ?? '',
      status: r.status ?? 'Upcoming',
    },
    createdAt: r.created_at,
  };
}
