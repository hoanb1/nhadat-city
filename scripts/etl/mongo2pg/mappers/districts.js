'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'districts', table: 'districts', key: 'mongo_id', sinceFields: [],
  columns: { mongo_id: 'text', code: 'integer', type: 'text', name: 'text', code_name: 'text', province_code: 'integer', province_code_name: 'text', province_name: 'text' },
  map(d, ctx) {
    ctx.unmapped('districts', c.id(d._id), c.rest(d, ['_id', 'Type', 'Code', 'Name', 'CodeName', 'ProvinceCode', 'ProvinceCodeName', 'ProvinceName']));
    return { mongo_id: c.id(d._id), code: c.int(d.Code), type: c.str(d.Type), name: c.str(d.Name) || c.str(d.CodeName) || '', code_name: c.str(d.CodeName) || '',
      province_code: c.int(d.ProvinceCode), province_code_name: c.str(d.ProvinceCodeName), province_name: c.str(d.ProvinceName) };
  },
};
