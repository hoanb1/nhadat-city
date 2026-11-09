'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'comments', table: 're_comments', key: 'mongo_id', sinceFields: ['timestamp', 'createdAt'],
  columns: { mongo_id: 'text', real_estate_mongo_id: 'text', user_mongo_id: 'text', name: 'text', content: 'text', parent_comment_mongo_id: 'text', created_at: 'timestamptz' },
  defaults: { real_estate_mongo_id: "''", content: "''", created_at: 'now()' },
  resolves: [{ table: 're_comments', col: 'real_estate_id', mongoCol: 'real_estate_mongo_id', ref: 'real_estates' }, { table: 're_comments', col: 'user_id', mongoCol: 'user_mongo_id', ref: 'users' }],
  map(d, ctx) {
    ctx.unmapped('comments', c.id(d._id), c.rest(d, ['_id', 'realEstateId', 'userId', 'name', 'message', 'timestamp', 'createdAt', 'parentCommentId']));
    return { mongo_id: c.id(d._id), real_estate_mongo_id: c.id(d.realEstateId), user_mongo_id: c.id(d.userId), name: c.str(d.name), content: c.str(d.message), parent_comment_mongo_id: c.id(d.parentCommentId),
      created_at: c.date(d.timestamp) || c.date(d.createdAt) };
  },
};
