'use strict';
const c = require('../lib/coerce');
const KNOWN = new Set(['_id', 'shortId', 'slug', 'status', 'listingMode', 'propertyType', 'title', 'description', 'area', 'price', 'totalPrice', 'pricePerM2',
  'legalDocs', 'direction', 'address', 'adminunit', 'oldaddress', 'oldadminunit', 'coordinates', 'longitude', 'latitude', 'images', 'thumbnailUrl', 'contact',
  'userId', 'source', 'sourceUrl', 'sourceType', 'sourceCode', 'userType', 'isScraped', 'views', 'postDuration', 'dynamicFields',
  'createdAt', 'updatedAt', 'postedAt', 'publishedAt', 'expireAt']);

module.exports = {
  collection: 'realEstate', table: 'real_estates', key: 'mongo_id', shortId: true, geom: true,
  columns: {
    mongo_id: 'text', short_id: 'text', slug: 'text', status: 'smallint', listing_mode: 'text', property_type: 'text', title: 'text', description: 'text',
    area: 'double precision', price: 'numeric', total_price: 'numeric', price_per_m2: 'numeric', legal_docs: 'text', direction: 'text', address: 'text',
    province_slug: 'text', district_slug: 'text', ward_slug: 'text', old_address: 'text', old_province_slug: 'text', old_district_slug: 'text', old_ward_slug: 'text',
    longitude: 'double precision', latitude: 'double precision', images: 'text[]', thumbnail_url: 'text', contact: 'jsonb',
    user_mongo_id: 'text', source_mongo_id: 'text', source_url: 'text', source_type: 'text', source_code: 'bigint', user_type: 'text',
    is_scraped: 'boolean', views: 'integer', post_duration: 'integer', dynamic_fields: 'jsonb',
    created_at: 'timestamptz', updated_at: 'timestamptz', posted_at: 'timestamptz', published_at: 'timestamptz', expire_at: 'timestamptz', extra: 'jsonb',
  },
  defaults: { status: '1', title: "''", description: "''", images: "'{}'::text[]", contact: "'{}'::jsonb", is_scraped: 'false', views: '0', dynamic_fields: "'[]'::jsonb", created_at: 'now()', extra: "'{}'::jsonb" },
  noUpdate: [],
  resolves: [{ table: 'real_estates', col: 'user_id', mongoCol: 'user_mongo_id', ref: 'users' }],
  map(d) {
    const au = c.obj(d.adminunit), oa = c.obj(d.oldadminunit), src = c.obj(d.source), contact = c.obj(d.contact);
    const extra = c.rest(d, KNOWN); // original camelCase keys (location, bedrooms, priceLabel, ownerId, ...)
    const auRest = c.omit(au, ['province', 'district', 'ward']); if (!c.isEmpty(auRest)) extra.adminunit_rest = auRest;
    const oaRest = c.omit(oa, ['province', 'district', 'ward']); if (!c.isEmpty(oaRest)) extra.oldadminunit_rest = oaRest;
    const srcRest = c.omit(src, ['_id']); if (!c.isEmpty(srcRest)) extra.source = srcRest;
    const price = c.numericBounded(d.price), tp = c.numericBounded(d.totalPrice), ppm = c.numericBounded(d.pricePerM2);
    const oor = {};
    if (price[1]) oor.price = d.price; if (tp[1]) oor.totalPrice = d.totalPrice; if (ppm[1]) oor.pricePerM2 = d.pricePerM2;
    if (!c.isEmpty(oor)) extra.out_of_range = oor;
    // geom from coordinates [lng,lat] (preferred), else longitude/latitude; (0,0)/out-of-range -> NULL
    const ll = c.lngLat(d.coordinates) || c.lngLat(d.longitude, d.latitude);
    return {
      mongo_id: c.id(d._id), short_id: c.str(d.shortId), slug: c.str(d.slug),
      status: c.int(d.status), listing_mode: c.str(d.listingMode), // RAW value (e.g. 'cho_thue'), NULL when missing
      property_type: c.str(d.propertyType), title: c.str(d.title), description: c.str(d.description),
      area: c.dbl(d.area), price: price[0], total_price: tp[0], price_per_m2: ppm[0],
      legal_docs: c.str(d.legalDocs), direction: c.str(d.direction), address: c.str(d.address),
      province_slug: c.str(au.province), district_slug: c.str(au.district), ward_slug: c.str(au.ward),
      old_address: c.str(d.oldaddress), old_province_slug: c.str(oa.province), old_district_slug: c.str(oa.district), old_ward_slug: c.str(oa.ward),
      longitude: ll ? ll.lng : null, latitude: ll ? ll.lat : null, _lng: ll ? ll.lng : null, _lat: ll ? ll.lat : null,
      images: c.strArr(d.images), thumbnail_url: c.str(d.thumbnailUrl), contact,
      user_mongo_id: c.id(d.userId) || c.id(contact.userId), source_mongo_id: c.id(src._id), source_url: c.str(d.sourceUrl), source_type: c.str(d.sourceType),
      source_code: c.bigint(d.sourceCode), user_type: c.str(d.userType), is_scraped: c.bool(d.isScraped),
      views: c.int(d.views), post_duration: c.int(d.postDuration), dynamic_fields: c.arr(d.dynamicFields),
      created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt), posted_at: c.date(d.postedAt), published_at: c.date(d.publishedAt), expire_at: c.date(d.expireAt),
      extra,
    };
  },
};
