'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'notifications', table: 'notifications', key: 'mongo_id', sinceFields: ['timestamp', 'createdAt'],
  columns: { mongo_id: 'text', real_estate_mongo_id: 'text', email_address: 'text', subject: 'text', content: 'text', email_sent: 'boolean', opened_count: 'integer', clicked_count: 'integer', last_view_count: 'integer', tracking_id: 'text', created_at: 'timestamptz', extra: 'jsonb' },
  defaults: { email_sent: 'false', opened_count: '0', clicked_count: '0', created_at: 'now()', extra: "'{}'::jsonb" },
  map(d) {
    return { mongo_id: c.id(d._id), real_estate_mongo_id: c.id(d.realEstateId), email_address: c.str(d.emailAddress), subject: c.str(d.subject), content: c.str(d.content), email_sent: c.bool(d.emailSent),
      opened_count: c.int(d.openedCount), clicked_count: c.int(d.clickedCount), last_view_count: c.int(d.lastViewCount), tracking_id: c.str(d.trackingId), created_at: c.date(d.timestamp) || c.date(d.createdAt),
      extra: c.rest(d, ['_id', 'realEstateId', 'emailAddress', 'subject', 'content', 'emailSent', 'openedCount', 'clickedCount', 'lastViewCount', 'trackingId', 'timestamp', 'createdAt']) };
  },
};
