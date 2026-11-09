'use strict';
const c = require('../lib/coerce');
const KNOWN = new Set(['_id', 'createdAt', 'updatedAt', 'emails', 'profile', 'services', 'shortId', 'username', 'loginHistory', 'status', 'roles']);

function flattenRoles(r) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { if (v._id) out.push(String(v._id)); else Object.values(v).forEach(walk); }
  };
  walk(r); return out;
}

module.exports = {
  collection: 'users', table: 'users', key: 'mongo_id',
  columns: {
    mongo_id: 'text', short_id: 'text', username: 'citext', email: 'citext', email_verified: 'boolean', emails: 'citext[]',
    password_hash: 'text', name: 'text', phone: 'text', address: 'text', avatar_url: 'text', roles: 'text[]',
    google_id: 'text', facebook_id: 'text', oauth: 'jsonb', profile: 'jsonb', login_history: 'jsonb',
    online: 'boolean', last_seen_at: 'timestamptz', created_at: 'timestamptz', updated_at: 'timestamptz', extra: 'jsonb',
  },
  defaults: { email_verified: 'false', emails: "'{}'::citext[]", roles: "'{user}'::text[]", oauth: "'{}'::jsonb", profile: "'{}'::jsonb", login_history: "'[]'::jsonb", created_at: 'now()', extra: "'{}'::jsonb" },
  resolves: [],
  // never keep secrets in the error table
  safeDoc: (d) => { const o = Object.assign({}, d); delete o.services; return o; },
  async prepare(ctx) {
    ctx.roleMap = new Map();
    const ra = await ctx.mdb.collection('role-assignment').find({}).toArray();
    for (const r of ra) {
      const uid = c.id(r.user && r.user._id); const role = r.role && r.role._id;
      if (!uid || !role) continue;
      if (!ctx.roleMap.has(uid)) ctx.roleMap.set(uid, new Set());
      ctx.roleMap.get(uid).add(String(role));
    }
  },
  fixConflict(row, col) { // unique collision on email/username/google_id/facebook_id (citext is case-insensitive)
    if (!['email', 'username', 'google_id', 'facebook_id'].includes(col)) return false;
    row.extra = Object.assign({}, row.extra);
    row.extra.etl_conflicts = Object.assign({}, row.extra.etl_conflicts, { [col]: row[col] });
    row[col] = null; return true;
  },
  map(d, ctx) {
    const mid = c.id(d._id);
    const emails = [];
    const seen = new Set();
    for (const e of c.arr(d.emails)) {
      const a = c.str(e && e.address); if (!a) continue;
      const k = a.trim().toLowerCase(); if (!k || seen.has(k)) continue; seen.add(k); emails.push(a.trim());
    }
    const p = c.obj(d.profile), sv = c.obj(d.services), g = c.obj(sv.google), f = c.obj(sv.facebook);
    const roles = new Set(flattenRoles(d.roles));
    for (const r of (ctx.roleMap && ctx.roleMap.get(mid)) || []) roles.add(r);
    const fbPic = f.picture && f.picture.data ? f.picture.data.url : (typeof f.picture === 'string' ? f.picture : null);
    const oauth = {};
    if (!c.isEmpty(g)) oauth.google = c.stripSecrets(c.omit(g, ['accessToken', 'idToken', 'refreshToken', 'scope', 'expiresAt']));
    if (!c.isEmpty(f)) oauth.facebook = c.stripSecrets(c.omit(f, ['accessToken', 'expiresAt']));
    const st = c.obj(d.status);
    const hist = c.arr(d.loginHistory).concat(c.arr(st.loginHistory));
    const extra = c.rest(d, KNOWN);
    // other third-party services (twitter, ...) minus secrets; password/resume/email/reset tokens are intentionally NOT copied
    const otherSv = c.stripSecrets(c.omit(sv, ['password', 'resume', 'email', 'google', 'facebook']));
    if (!c.isEmpty(otherSv)) extra.services_other = otherSv;
    const stRest = c.omit(st, ['online', 'lastSeen', 'loginHistory']);
    if (!c.isEmpty(stRest)) extra.status_rest = stRest;
    return {
      mongo_id: mid, short_id: c.str(d.shortId), username: c.str(d.username) || null,
      email: emails[0] || null, email_verified: !!(c.arr(d.emails)[0] && c.arr(d.emails)[0].verified === true),
      emails, password_hash: c.str(c.obj(sv.password).bcrypt),
      name: c.str(p.name) || c.str(g.name) || c.str(f.name), phone: c.str(p.phone) || c.str(p.phoneNumber),
      address: c.str(p.address), avatar_url: c.str(p.avatar) || c.str(g.picture) || c.str(fbPic),
      roles: roles.size ? [...roles] : ['user'],
      google_id: c.str(g.id), facebook_id: c.str(f.id), oauth,
      profile: p, // full Meteor profile kept: app reads profile.name/avatar/avatarId/favorites; name/phone/address/avatar_url columns are denormalised copies login_history: hist,
      online: c.bool(st.online), last_seen_at: c.date(st.lastSeen),
      created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt), extra,
    };
  },
};
