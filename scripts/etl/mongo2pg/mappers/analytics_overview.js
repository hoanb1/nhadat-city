'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'analytics_overview', table: 'app_config', key: 'key', sinceFields: [],
  columns: { key: 'text', value: 'jsonb', updated_at: 'timestamptz' },
  defaults: { value: "'{}'::jsonb", updated_at: 'now()' },
  map(d) { return { key: c.str(d._id) === 'global_overview' || !d._id ? 'global_overview' : 'analytics_overview:' + c.id(d._id), value: c.omit(d, ['_id']), updated_at: c.date(d.updatedAt) }; },
};
