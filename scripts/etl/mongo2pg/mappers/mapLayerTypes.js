'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'mapLayerTypes', table: 'map_layer_types', key: 'mongo_id', sinceFields: [],
  columns: { mongo_id: 'text', name: 'text', sort_order: 'integer', parent_id: 'text', active: 'boolean', auto_show: 'boolean', created_at: 'timestamptz' },
  defaults: { sort_order: '0', active: 'true', auto_show: 'false' },
  map(d, ctx) {
    ctx.unmapped('mapLayerTypes', c.id(d._id), c.rest(d, ['_id', 'name', 'order', 'parentId', 'createdAt', 'active', 'autoShow']));
    return { mongo_id: c.id(d._id), name: c.str(d.name) || c.id(d._id), sort_order: c.int(d.order), parent_id: c.id(d.parentId), active: c.bool(d.active), auto_show: c.bool(d.autoShow), created_at: c.date(d.createdAt) };
  },
};
