'use strict';
const c = require('../lib/coerce');
const KNOWN = ['_id', 'slug', 'title', 'author', 'summary', 'content', 'status', 'category', 'tags', 'faqs', 'source', 'targetKeyword', 'metaTitle', 'metaDescription', 'views', 'wordCount', 'createdAt', 'updatedAt'];
module.exports = {
  collection: 'blog', table: 'blog_posts', key: 'mongo_id',
  columns: { mongo_id: 'text', slug: 'text', title: 'text', author: 'text', summary: 'text', content: 'text', status: 'text', category: 'text', tags: 'text[]', faqs: 'jsonb',
    source: 'text', target_keyword: 'text', meta_title: 'text', meta_description: 'text', views: 'integer', word_count: 'integer', created_at: 'timestamptz', updated_at: 'timestamptz', extra: 'jsonb' },
  defaults: { status: "'published'", tags: "'{}'::text[]", faqs: "'[]'::jsonb", views: '0', created_at: 'now()', extra: "'{}'::jsonb" },
  fixConflict(row, col) { if (col !== 'slug') return false; row.slug = `${row.slug}-${row.mongo_id.slice(-6)}`; return true; },
  map(d) {
    const slug = c.str(d.slug); if (!slug) throw new Error('blog without slug');
    return { mongo_id: c.id(d._id), slug, title: c.str(d.title) || slug, author: c.str(d.author), summary: c.str(d.summary), content: c.str(d.content), status: c.str(d.status),
      category: c.str(d.category), tags: c.strArr(d.tags), faqs: c.arr(d.faqs), source: c.str(d.source), target_keyword: c.str(d.targetKeyword), meta_title: c.str(d.metaTitle),
      meta_description: c.str(d.metaDescription), views: c.int(d.views), word_count: c.int(d.wordCount), created_at: c.date(d.createdAt), updated_at: c.date(d.updatedAt), extra: c.rest(d, KNOWN) };
  },
};
