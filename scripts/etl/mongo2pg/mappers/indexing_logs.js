'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'indexing_logs', table: 'indexing_logs', key: 'mongo_id', sinceFields: ['timestamp', 'createdAt'],
  columns: { mongo_id: 'text', url: 'text', engine: 'text', provider: 'text', status: 'text', success: 'boolean', http_status: 'integer', created_at: 'timestamptz', extra: 'jsonb' },
  defaults: { created_at: 'now()', extra: "'{}'::jsonb" },
  map(d) {
    const st = c.str(d.status);
    const success = typeof d.success === 'boolean' ? d.success : st != null ? ['success', 'ok', 'submitted', 'sent', 'done'].includes(st.toLowerCase()) : null;
    return { mongo_id: c.id(d._id), url: c.str(d.url), engine: c.str(d.engine), provider: c.str(d.provider), status: st, success, http_status: c.int(d.httpStatus),
      created_at: c.date(d.timestamp) || c.date(d.createdAt), extra: c.rest(d, ['_id', 'url', 'engine', 'provider', 'status', 'success', 'httpStatus', 'timestamp', 'createdAt']) };
  },
};
