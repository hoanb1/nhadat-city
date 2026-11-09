'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'push_subscriptions', table: 'push_subscriptions', key: 'mongo_id', sinceFields: ['createdAt'],
  columns: { mongo_id: 'text', endpoint: 'text', keys: 'jsonb', expiration_time: 'timestamptz', user_mongo_id: 'text', created_at: 'timestamptz' },
  defaults: { keys: "'{}'::jsonb", created_at: 'now()' },
  resolves: [{ table: 'push_subscriptions', col: 'user_id', mongoCol: 'user_mongo_id', ref: 'users' }],
  map(d, ctx) {
    const ep = c.str(d.endpoint); if (!ep) throw new Error('push subscription without endpoint');
    ctx.unmapped('push_subscriptions', c.id(d._id), c.rest(d, ['_id', 'endpoint', 'expirationTime', 'keys', 'userId', 'createdAt']));
    return { mongo_id: c.id(d._id), endpoint: ep, keys: c.obj(d.keys), expiration_time: c.date(d.expirationTime), user_mongo_id: c.id(d.userId), created_at: c.date(d.createdAt) };
  },
};
