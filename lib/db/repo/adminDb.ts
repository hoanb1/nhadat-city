import { sql } from '@/lib/db/pg';

/**
 * Allow-list of tables exposed by the admin "database explorer" (replaces Mongo's dynamic collection names).
 * value = column used for ORDER BY ... DESC (newest first).
 */
export const EXPLORER_TABLES: Record<string, string> = {
  users: 'id',
  real_estates: 'id',
  real_estate_images: 'id',
  projects: 'id',
  blog_posts: 'id',
  districts: 'id',
  provinces_2025: 'code',
  wards_2025: 'code',
  planning_layers: 'id',
  map_layer_types: 'id',
  master_data: 'id',
  indexing_queue: 'id',
  indexing_logs: 'id',
  scraping_logs: 'id',
  ai_logs: 'id',
  analytics_daily: 'day',
  app_config: 'key',
  seo_keywords: 'id',
  api_cache: 'key',
  notifications: 'id',
  push_subscriptions: 'id',
  chat_sessions: 'id',
  user_ai_preferences: 'user_key',
  re_comments: 'id',
  messages: 'id',
  reports: 'id',
  help_requests: 'id',
  campaigns: 'id',
  emails: 'id',
  state_land_prices: 'id',
};

/** Legacy Mongo collection name -> table (so old bookmarks / clients keep working). */
const LEGACY_ALIASES: Record<string, string> = {
  realEstate: 'real_estates',
  RealEstateImages: 'real_estate_images',
  helpRequests: 'help_requests',
  mapLayers: 'planning_layers',
  mapLayerTypes: 'map_layer_types',
  comments: 're_comments',
  reComments: 're_comments',
  analytics_overview: 'app_config',
  ai_config: 'app_config',
  province2025: 'provinces_2025',
  ward2025: 'wards_2025',
  blog: 'blog_posts',
};

export function resolveExplorerTable(name: string | null): string | null {
  if (!name) return null;
  const t = Object.prototype.hasOwnProperty.call(LEGACY_ALIASES, name) ? LEGACY_ALIASES[name] : name;
  return Object.prototype.hasOwnProperty.call(EXPLORER_TABLES, t) ? t : null;
}

/** Fast row-count estimate (pg_class.reltuples); falls back to exact count when never analyzed. */
export async function estimateCount(table: string): Promise<number> {
  const [r] = await sql`SELECT reltuples::float8 AS n FROM pg_class WHERE oid = to_regclass(${'public.' + table})`;
  if (r && Number(r.n) >= 0) return Math.round(Number(r.n));
  const [c] = await sql`SELECT count(*)::float8 AS n FROM ${sql(table)}`;
  return Number(c?.n ?? 0);
}
