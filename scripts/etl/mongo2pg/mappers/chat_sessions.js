'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'chat_sessions', table: 'chat_sessions', key: 'mongo_id',
  columns: { mongo_id: 'text', user_mongo_id: 'text', title: 'text', messages: 'jsonb', created_at: 'timestamptz', updated_at: 'timestamptz' },
  defaults: { messages: "'[]'::jsonb", created_at: 'now()', updated_at: 'now()' },
  resolves: [{ table: 'chat_sessions', col: 'user_id', mongoCol: 'user_mongo_id', ref: 'users' }],
  map(d, ctx) {
    ctx.unmapped('chat_sessions', c.id(d._id), c.rest(d, ['_id', 'userId', 'title', 'messages', 'createdAt', 'updatedAt']));
    return { mongo_id: c.id(d._id), user_mongo_id: c.id(d.userId), title: c.str(d.title), messages: c.arr(d.messages), created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt) };
  },
};
