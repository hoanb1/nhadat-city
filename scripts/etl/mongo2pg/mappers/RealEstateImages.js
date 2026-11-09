'use strict';
const c = require('../lib/coerce');
// Meteor-Files boilerplate derivable from other fields (not copied): extension, extensionWithDot, mime-type, type(dup of mime), _downloadRoute, _collectionName, is*, _storagePath
const DERIVED = ['extension', 'extensionWithDot', 'mime-type', '_downloadRoute', '_collectionName', 'isVideo', 'isAudio', 'isImage', 'isText', 'isJSON', 'isPDF', '_storagePath'];
const KNOWN = new Set(['_id', 'name', 'ext', 'mime', 'type', 'size', 'path', 'meta', 'versions', 'userId', 'createdAt', ...DERIVED]);

module.exports = {
  collection: 'RealEstateImages', table: 'real_estate_images', key: 'mongo_id',
  columns: {
    mongo_id: 'text', real_estate_mongo_id: 'text', name: 'text', ext: 'text', mime: 'text', size_bytes: 'bigint', path: 'text', original_path: 'text',
    original_width: 'integer', original_height: 'integer', preprocess_path: 'text', processed: 'boolean', source_url: 'text', user_mongo_id: 'text',
    upload_date: 'date', created_at: 'timestamptz', meta: 'jsonb',
  },
  defaults: { meta: "'{}'::jsonb" },
  resolves: [{ table: 'real_estate_images', col: 'real_estate_id', mongoCol: 'real_estate_mongo_id', ref: 'real_estates' }],
  map(d) {
    const m = c.obj(d.meta), v = c.obj(d.versions), o = c.obj(v.original), pp = c.obj(v.preprocess);
    const meta = c.omit(m, ['realEstateId', 'processed', 'source', 'uploadDate']);
    Object.assign(meta, c.rest(d, KNOWN));
    const ov = c.omit(o, ['path', 'width', 'height']), pv = c.omit(pp, ['path']);
    const vv = {}; if (!c.isEmpty(ov)) vv.original = ov; if (!c.isEmpty(pv)) vv.preprocess = pv;
    const vrest = c.omit(v, ['original', 'preprocess']);
    if (!c.isEmpty(vv) || !c.isEmpty(vrest)) meta.versions = Object.assign(vv, vrest);
    if (d.type && d.mime && d.type !== d.mime) meta.type = d.type;
    return {
      mongo_id: c.id(d._id), real_estate_mongo_id: c.id(m.realEstateId), name: c.str(d.name), ext: c.str(d.ext || d.extension), mime: c.str(d.mime || d.type),
      size_bytes: c.bigint(d.size), path: c.str(d.path), original_path: c.str(o.path), original_width: c.int(o.width), original_height: c.int(o.height),
      preprocess_path: c.str(pp.path), processed: c.bool(m.processed), source_url: c.str(m.source), user_mongo_id: c.id(d.userId),
      upload_date: c.dateOnly(m.uploadDate), created_at: c.date(d.createdAt), meta,
    };
  },
};
