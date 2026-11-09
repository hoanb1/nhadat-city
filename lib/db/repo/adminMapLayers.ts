import { sql } from '@/lib/db/pg';
import type { Doc } from '@/lib/db/pgUtil';

/** planning_layers row -> legacy Mongo `mapLayers` document shape. */
export function layerOut(r: Doc): Doc {
  const extra = r.extra && typeof r.extra === 'object' ? r.extra : {};
  const o: Doc = { ...extra, _id: r.mongo_id ?? String(r.id) };
  const put = (k: string, v: unknown) => { if (v !== null && v !== undefined) o[k] = v; };
  put('name', r.name);
  put('url', r.tile_url);
  put('type', r.type_id);
  put('format', r.format);
  put('active', r.active);
  put('order', r.sort_order);
  put('description', r.description);
  put('opacity', r.opacity);
  put('saturation', r.saturation);
  put('color', r.color);
  put('geoserverLayer', r.geoserver_layer);
  put('autoLoad', r.auto_load);
  put('visible', r.visible);
  put('activeType', r.active_type);
  put('zoomMin', r.min_zoom);
  put('zoomMax', r.max_zoom);
  put('boundingBox', r.bbox && Object.keys(r.bbox).length ? r.bbox : undefined);
  put('createdAt', r.created_at);
  put('updatedAt', r.updated_at);
  return o;
}

const NOT_NULL = new Set(['name', 'tile_url', 'sort_order', 'opacity', 'auto_load', 'min_zoom', 'max_zoom']);
const BODY_TO_COL: Record<string, string> = {
  name: 'name', url: 'tile_url', type: 'type_id', format: 'format', active: 'active', isActive: 'active',
  order: 'sort_order', description: 'description', opacity: 'opacity', saturation: 'saturation',
  color: 'color', geoserverLayer: 'geoserver_layer', autoLoad: 'auto_load', visible: 'visible',
  activeType: 'active_type', zoomMin: 'min_zoom', zoomMax: 'max_zoom', boundingBox: 'bbox',
};
const INT_COLS = new Set(['sort_order', 'opacity', 'saturation', 'min_zoom', 'max_zoom']);
const BOOL_COLS = new Set(['active', 'auto_load', 'visible', 'active_type']);

/** Split a request body into typed planning_layers columns and the remainder (-> extra). */
export function layerCols(body: Doc): { cols: Doc; rest: Doc } {
  const cols: Doc = {};
  const rest: Doc = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (k === '_id' || k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
    const col = BODY_TO_COL[k];
    if (!col) { rest[k] = v; continue; }
    if (v === null || v === undefined) { if (!NOT_NULL.has(col)) cols[col] = null; continue; }
    if (INT_COLS.has(col)) {
      let n = Number(v);
      if (!Number.isFinite(n)) continue;
      // admin-ui sends opacity as a 0..1 fraction; column is an integer percentage
      if (col === 'opacity' && n > 0 && n <= 1) n = n * 100;
      cols[col] = Math.round(n);
    } else if (BOOL_COLS.has(col)) {
      cols[col] = !!v;
    } else if (col === 'bbox') {
      cols[col] = sql.json((typeof v === 'object' ? v : {}) as any);
    } else {
      cols[col] = String(v);
    }
  }
  return { cols, rest };
}
