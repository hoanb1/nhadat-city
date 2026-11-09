'use strict';
const c = require('../lib/coerce');
// master_data rows for propertyTypes / directions / legalDocumentTypes / roadTypes / dynamicFields
module.exports = (collection, kind) => ({
  collection, kind, table: 'master_data', key: ['kind', 'mongo_id'], sinceFields: [],
  columns: { kind: 'text', mongo_id: 'text', name: 'text', description: 'text', sort_order: 'integer', type: 'text', fields: 'jsonb', extra: 'jsonb' },
  defaults: { sort_order: '0', fields: "'[]'::jsonb", extra: "'{}'::jsonb" },
  map(d) {
    const extra = c.rest(d, ['_id', 'name', 'description', 'order', 'type', 'fields', 'values']);
    return { kind, mongo_id: c.id(d._id), name: c.str(d.name) || c.id(d._id), description: c.str(d.description), sort_order: c.int(d.order), type: c.str(d.type),
      fields: c.arr(d.fields).length ? c.arr(d.fields) : c.arr(d.values), extra };
  },
});
