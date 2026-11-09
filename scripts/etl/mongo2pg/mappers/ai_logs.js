'use strict';
const c = require('../lib/coerce');
module.exports = {
  collection: 'ai_logs', table: 'ai_logs', key: 'mongo_id', sinceFields: ['createdAt'],
  columns: { mongo_id: 'text', action: 'text', provider: 'text', model: 'text', tokens_used: 'integer', session_id: 'text', prompt: 'text', response: 'text', tools_used: 'text[]', created_at: 'timestamptz' },
  defaults: { tools_used: "'{}'::text[]", created_at: 'now()' },
  map(d, ctx) {
    ctx.unmapped('ai_logs', c.id(d._id), c.rest(d, ['_id', 'action', 'provider', 'model', 'tokensUsed', 'sessionId', 'prompt', 'response', 'toolsUsed', 'createdAt']));
    return { mongo_id: c.id(d._id), action: c.str(d.action), provider: c.str(d.provider), model: c.str(d.model), tokens_used: c.int(d.tokensUsed), session_id: c.id(d.sessionId),
      prompt: c.str(d.prompt), response: c.str(d.response), tools_used: c.strArr(d.toolsUsed), created_at: c.date(d.createdAt) };
  },
};
