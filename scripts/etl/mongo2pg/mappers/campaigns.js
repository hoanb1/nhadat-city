'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'campaigns', table: 'campaigns', key: 'mongo_id',
  columns: { mongo_id: 'text', name: 'text', location: 'text', description: 'text', start_date: 'date', end_date: 'date', status: 'text', created_at: 'timestamptz', extra: 'jsonb' },
  defaults: { created_at: 'now()', extra: "'{}'::jsonb" },
  map(d) {
    const n = c.obj(d.name); const flat = typeof d.name === 'string' ? { name: d.name } : n; // fields were nested under `name.*`
    const extra = c.rest(d, ['_id', 'name', 'createdAt']);
    const nr = c.omit(flat, ['name', 'location', 'description', 'startDate', 'endDate', 'status']); if (!c.isEmpty(nr)) Object.assign(extra, nr);
    return { mongo_id: c.id(d._id), name: c.str(flat.name), location: c.str(flat.location), description: c.str(flat.description), start_date: c.dateOnly(flat.startDate), end_date: c.dateOnly(flat.endDate),
      status: c.str(flat.status), created_at: c.date(d.createdAt), extra };
  },
};
