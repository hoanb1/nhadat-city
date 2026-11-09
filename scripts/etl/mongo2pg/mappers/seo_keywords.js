'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'seo_keywords', table: 'seo_keywords', key: 'mongo_id', sinceFields: [],
  columns: { mongo_id: 'text', keyword: 'text', volume: 'integer', extra: 'jsonb' }, defaults: { volume: '0', extra: "'{}'::jsonb" },
  map(d) { return { mongo_id: c.id(d._id), keyword: c.str(d.keyword) || c.str(d.term) || c.id(d._id), volume: c.int(d.volume), extra: c.rest(d, ['_id', 'keyword', 'volume']) }; },
};
