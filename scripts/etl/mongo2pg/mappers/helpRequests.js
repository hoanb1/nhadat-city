'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'helpRequests', table: 'help_requests', key: 'mongo_id',
  columns: { mongo_id: 'text', name: 'text', description: 'text', location: 'text', longitude: 'double precision', latitude: 'double precision', requester: 'jsonb', created_at: 'timestamptz', expiration_date: 'timestamptz' },
  defaults: { requester: "'{}'::jsonb", created_at: 'now()' },
  map(d, ctx) {
    ctx.unmapped('helpRequests', c.id(d._id), c.rest(d, ['_id', 'name', 'description', 'location', 'coordinates', 'user', 'createdAt', 'expirationDate']));
    const ll = c.lngLat(d.coordinates);
    return { mongo_id: c.id(d._id), name: c.str(d.name), description: c.str(d.description), location: c.str(d.location), longitude: ll ? ll.lng : null, latitude: ll ? ll.lat : null,
      requester: c.obj(d.user), created_at: c.date(d.createdAt), expiration_date: c.date(d.expirationDate) };
  },
};
