'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'reports', table: 'reports', key: 'mongo_id',
  columns: { mongo_id: 'text', post_mongo_id: 'text', reported_by: 'text', reason: 'text', details: 'text', client_info: 'jsonb', reviewed: 'boolean', created_at: 'timestamptz', updated_at: 'timestamptz' },
  defaults: { post_mongo_id: "''", client_info: "'{}'::jsonb", reviewed: 'false', created_at: 'now()' },
  map(d, ctx) {
    ctx.unmapped('reports', c.id(d._id), c.rest(d, ['_id', 'postId', 'reportedBy', 'reason', 'details', 'clientInfo', 'reviewed', 'createdAt', 'updatedAt']));
    return { mongo_id: c.id(d._id), post_mongo_id: c.id(d.postId), reported_by: c.str(d.reportedBy), reason: c.str(d.reason), details: c.str(d.details), client_info: c.obj(d.clientInfo),
      reviewed: c.bool(d.reviewed), created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt) };
  },
};
