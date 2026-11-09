'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'indexing_queue', table: 'indexing_queue',
  // url is UNIQUE (migration 007): conflict target = url, the row with the latest updated_at wins (in-batch and across batches)
  key: 'url', noUpdate: ['created_at'],
  prefer: (oldR, newR) => (Date.parse(newR.updated_at) || 0) >= (Date.parse(oldR.updated_at) || 0),
  updateWhere: 'COALESCE(EXCLUDED.updated_at, indexing_queue.updated_at) >= indexing_queue.updated_at',
  columns: { mongo_id: 'text', url: 'text', type: 'text', status: 'text', priority: 'integer', retry_count: 'integer', attempts: 'integer', next_attempt_at: 'timestamptz', google_submitted_at: 'timestamptz', source: 'text', created_at: 'timestamptz', updated_at: 'timestamptz', extra: 'jsonb' },
  defaults: { status: "'pending'", priority: '1', retry_count: '0', attempts: '0', created_at: 'now()', updated_at: 'now()', extra: "'{}'::jsonb" },
  map(d) {
    return { mongo_id: c.id(d._id), url: c.str(d.url) || '', type: c.str(d.type), status: (c.str(d.status) || '').toLowerCase() || null, priority: c.int(d.priority), retry_count: c.int(d.retryCount), attempts: c.int(d.attempts),
      next_attempt_at: c.date(d.nextAttemptAt), google_submitted_at: c.date(d.googleSubmittedAt), source: c.str(d.source), created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt),
      extra: c.rest(d, ['_id', 'url', 'type', 'status', 'priority', 'retryCount', 'attempts', 'nextAttemptAt', 'googleSubmittedAt', 'source', 'createdAt', 'updatedAt']) };
  },
};
