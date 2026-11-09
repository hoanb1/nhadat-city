'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'analytics_daily', table: 'analytics_daily', key: 'day', sinceFields: [],
  columns: { day: 'date', views: 'integer', visitors: 'integer' },
  defaults: { views: '0', visitors: '0' },
  map(d, ctx) {
    const day = c.dateOnly(d._id) || c.dateOnly(d.date); if (!day) throw new Error('analytics_daily without date');
    ctx.unmapped('analytics_daily', c.id(d._id), c.rest(d, ['_id', 'date', 'views', 'visitors']));
    return { day, views: c.int(d.views), visitors: c.int(d.visitors) };
  },
};
