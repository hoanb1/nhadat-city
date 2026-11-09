import { sql } from '../pg';
import { put, type Doc } from '../pgUtil';

/** blog_posts row -> legacy Mongo `blog` document shape (extra spread first; typed columns win). */
export function mapBlogRow(r: Doc): Doc {
  const d: Doc = r.extra && typeof r.extra === 'object' ? { ...r.extra } : {};
  d._id = r.mongo_id ?? String(r.id);
  put(d, 'slug', r.slug);
  put(d, 'title', r.title);
  put(d, 'author', r.author);
  put(d, 'summary', r.summary);
  put(d, 'content', r.content);
  put(d, 'status', r.status);
  put(d, 'category', r.category);
  put(d, 'tags', r.tags);
  put(d, 'faqs', r.faqs);
  put(d, 'source', r.source);
  put(d, 'targetKeyword', r.target_keyword);
  put(d, 'metaTitle', r.meta_title);
  put(d, 'metaDescription', r.meta_description);
  put(d, 'views', r.views);
  put(d, 'wordCount', r.word_count);
  put(d, 'createdAt', r.created_at);
  put(d, 'updatedAt', r.updated_at);
  return d;
}

/** Latest published posts with a usable slug (blog index). */
export async function listPublishedBlog(limit = 60): Promise<Doc[]> {
  const rows = await sql`
    SELECT * FROM blog_posts
    WHERE status = 'published' AND slug IS NOT NULL AND slug NOT IN ('null', '')
    ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return rows.map(mapBlogRow);
}

export async function getPublishedBlogBySlug(slug: string): Promise<Doc | null> {
  const rows = await sql`SELECT * FROM blog_posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
  return rows.length ? mapBlogRow(rows[0]) : null;
}

export async function getRelatedBlog(currentSlug: string, limit = 4): Promise<Doc[]> {
  const rows = await sql`
    SELECT * FROM blog_posts WHERE slug <> ${currentSlug} AND status = 'published'
    ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return rows.map(mapBlogRow);
}
