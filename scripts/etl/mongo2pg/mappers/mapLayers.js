'use strict';
const c = require('../lib/coerce');
const KNOWN = ['_id', 'name', 'type', 'format', 'url', 'active', 'autoLoad', 'opacity', 'order', 'description', 'boundingBox', 'zoomMin', 'zoomMax', 'color', 'saturation', 'geoServerLayer', 'createdAt', 'visible', 'updatedAt', 'activeType'];
// same heuristics as scripts/etl/06_planning_layers.js
function inferProvince(name, url) {
  const t = `${name || ''} ${url || ''}`.toLowerCase();
  if (t.includes('hanoi') || t.includes('hà nội')) return 'ha-noi';
  if (t.includes('hcm') || t.includes('hồ chí minh') || t.includes('hóc môn')) return 'ho-chi-minh';
  if (t.includes('binhduong') || t.includes('bình dương')) return 'ho-chi-minh';
  if (t.includes('vungtau') || t.includes('vũng tàu')) return 'ho-chi-minh';
  if (t.includes('binhphuoc') || t.includes('bình phước')) return 'dong-nai';
  if (t.includes('danang') || t.includes('đà nẵng')) return 'da-nang';
  if (t.includes('cantho') || t.includes('cần thơ')) return 'can-tho';
  if (t.includes('hungyen') || t.includes('hưng yên')) return 'hung-yen';
  if (t.includes('bacgiang') || t.includes('bắc giang')) return 'bac-ninh';
  if (t.includes('khanhhoa') || t.includes('khánh hòa')) return 'khanh-hoa';
  if (t.includes('longan') || t.includes('long an')) return 'tay-ninh';
  if (t.includes('ninhbinh') || t.includes('ninh bình')) return 'ninh-binh';
  return 'toan-quoc';
}
function inferType(name, url) {
  const t = `${name || ''} ${url || ''}`.toLowerCase();
  if (t.includes('satellite') || t.includes('google map') || t.includes('open street')) return 've-tinh';
  if (t.includes('ranhthua') || t.includes('thửa đất') || t.includes('goonranh')) return 'ranh-thua';
  if (t.includes('adminunit') || t.includes('địa giới') || t.includes('địa chính')) return 'hanh-chinh';
  return 'quy-hoach';
}
module.exports = {
  collection: 'mapLayers', table: 'planning_layers', key: 'id', sinceFields: [],
  columns: { id: 'text', mongo_id: 'text', name: 'text', province_slug: 'text', layer_type: 'text', format: 'text', tile_url: 'text', min_zoom: 'integer', max_zoom: 'integer', bbox: 'jsonb', active: 'boolean',
    type_id: 'text', description: 'text', sort_order: 'integer', opacity: 'integer', saturation: 'integer', color: 'text', geoserver_layer: 'text', auto_load: 'boolean', visible: 'boolean', active_type: 'boolean',
    created_at: 'timestamptz', updated_at: 'timestamptz', extra: 'jsonb' },
  defaults: { min_zoom: '0', max_zoom: '22', bbox: "'{}'::jsonb", active: 'true', sort_order: '0', opacity: '100', auto_load: 'false', extra: "'{}'::jsonb" },
  map(d) {
    const name = c.str(d.name) || 'Lớp bản đồ', url = c.str(d.url) || '', mid = c.id(d._id);
    return { id: mid, mongo_id: mid, name, province_slug: inferProvince(name, url), layer_type: inferType(name, url), format: c.str(d.format) || 'raster', tile_url: url,
      min_zoom: c.int(d.zoomMin), max_zoom: c.int(d.zoomMax), bbox: c.obj(d.boundingBox), active: d.active !== false, type_id: c.id(d.type), description: c.str(d.description),
      sort_order: c.int(d.order), opacity: c.int(d.opacity), saturation: c.int(d.saturation), color: c.str(d.color), geoserver_layer: c.str(d.geoServerLayer), auto_load: c.bool(d.autoLoad),
      visible: c.bool(d.visible), active_type: c.bool(d.activeType), created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt), extra: c.rest(d, KNOWN) };
  },
};
