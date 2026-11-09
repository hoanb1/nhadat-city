'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'messages', table: 'messages', key: 'mongo_id', sinceFields: ['timestamp', 'createdAt'],
  columns: { mongo_id: 'text', real_estate_mongo_id: 'text', sender_mongo_id: 'text', receiver_mongo_id: 'text', message: 'text', read: 'boolean', created_at: 'timestamptz' },
  defaults: { sender_mongo_id: "''", receiver_mongo_id: "''", message: "''", read: 'false', created_at: 'now()' },
  resolves: [{ table: 'messages', col: 'sender_id', mongoCol: 'sender_mongo_id', ref: 'users' }, { table: 'messages', col: 'receiver_id', mongoCol: 'receiver_mongo_id', ref: 'users' }],
  map(d, ctx) {
    ctx.unmapped('messages', c.id(d._id), c.rest(d, ['_id', 'realEstateId', 'senderId', 'receiverId', 'message', 'timestamp', 'createdAt', 'read']));
    return { mongo_id: c.id(d._id), real_estate_mongo_id: c.id(d.realEstateId), sender_mongo_id: c.id(d.senderId), receiver_mongo_id: c.id(d.receiverId), message: c.str(d.message),
      read: c.bool(d.read), created_at: c.date(d.timestamp) || c.date(d.createdAt) };
  },
};
