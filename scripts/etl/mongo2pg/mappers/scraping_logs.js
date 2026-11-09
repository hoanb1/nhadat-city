'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'scraping_logs', table: 'scraping_logs', key: 'mongo_id', sinceFields: ['startedAt'],
  columns: { mongo_id: 'text', target: 'text', status: 'text', started_at: 'timestamptz', ended_at: 'timestamptz', items_scraped: 'integer', errors: 'integer', duration_limit: 'integer', extra: 'jsonb' },
  defaults: { started_at: 'now()', items_scraped: '0', errors: '0', extra: "'{}'::jsonb" },
  map(d) {
    return { mongo_id: c.id(d._id), target: c.str(d.target), status: c.str(d.status), started_at: c.date(d.startedAt), ended_at: c.date(d.endedAt), items_scraped: c.int(d.itemsScraped), errors: c.int(d.errors),
      duration_limit: c.int(d.durationLimit), extra: c.rest(d, ['_id', 'target', 'status', 'startedAt', 'endedAt', 'itemsScraped', 'errors', 'durationLimit']) };
  },
};
