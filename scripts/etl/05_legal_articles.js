/**
 * ETL Script: Task 7 - Populate legal_articles (all 1,049 documents from blog)
 */
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const MONGO_URI = require('./_env').need('MONGODB_URI');
const PG_URI = require('./_env').need('DATABASE_URL');

function cleanHtml(html) {
  if (!html) return '';
  let cleaned = html;
  cleaned = cleaned.replace(/<div[^>]*>(?:(?!<div)[\s\S])*?(?:ve-so\.com|xổ số|lô gan|thử vận may)(?:(?!<\/div>)[\s\S])*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>(?:(?!<p)[\s\S])*?(?:ve-so\.com|xổ số|lô gan|thử vận may)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleaned = cleaned.replace(/<a[^>]*?href=["'][^"']*ve-so\.com[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  cleaned = cleaned.replace(/ve-so\.com/gi, 'nhadat.city');
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
  return cleaned.trim();
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/Chuyên gia bất động sản chia sẻ kinh nghiệm đầu tư tiền trúng xổ số vào nhà đất an toàn nhất\./gi, 'Chuyên gia bất động sản chia sẻ kinh nghiệm đầu tư nhà đất an toàn nhất.')
    .replace(/tiền trúng xổ số vào/gi, '')
    .replace(/ve-so\.com/gi, 'nhadat.city')
    .trim();
}

async function run() {
  const mClient = new MongoClient(MONGO_URI);
  await mClient.connect();
  const db = mClient.db();

  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 7: Populating legal_articles ===');
  const mongoBlogs = await db.collection('blog').find().toArray();
  console.log(`Fetched ${mongoBlogs.length} articles from MongoDB blog.`);

  await pClient.query('TRUNCATE TABLE legal_articles RESTART IDENTITY CASCADE;');

  const seenSlugs = new Set();
  let duplicateCount = 0;

  const batchSize = 100;
  for (let i = 0; i < mongoBlogs.length; i += batchSize) {
    const chunk = mongoBlogs.slice(i, i + batchSize);

    for (const doc of chunk) {
      let slug = doc.slug;
      if (!slug) {
        slug = `bai-viet-${doc._id.toString()}`;
      }
      if (seenSlugs.has(slug)) {
        duplicateCount++;
        slug = `${slug}-${doc._id.toString().slice(-6)}`;
      }
      seenSlugs.add(slug);

      const title = doc.title || 'Thông tin pháp lý quy hoạch';
      const category = doc.category || 'phap-ly-quy-hoach';
      const summary = cleanText(doc.summary || doc.metaDescription || '');
      const content_html = cleanHtml(doc.content || '');
      const rawFaqs = Array.isArray(doc.faqs) ? doc.faqs : [];
      const normalizedFaqs = rawFaqs.map(f => ({
        q: cleanText(f.q || f.question || ''),
        a: cleanText(f.a || f.answer || ''),
        question: cleanText(f.question || f.q || ''),
        answer: cleanText(f.answer || f.a || ''),
      })).filter(f => f.q && f.a);
      const faqs = JSON.stringify(normalizedFaqs);
      const tags = Array.isArray(doc.tags) ? doc.tags : [];

      // Calculate clean word count
      const plainText = content_html.replace(/<[^>]+>/g, ' ');
      const word_count = plainText.split(/\s+/).filter(Boolean).length;

      const published_at = doc.publishedAt || doc.createdAt || new Date();
      const updated_at = doc.updatedAt || new Date();

      await pClient.query(`
        INSERT INTO legal_articles (
          slug, title, category, summary, content_html,
          faqs, tags, word_count, published_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        slug, title, category, summary, content_html,
        faqs, tags, word_count, published_at, updated_at
      ]);
    }

    if ((i + chunk.length) % 500 === 0 || i + chunk.length === mongoBlogs.length) {
      console.log(`Inserted ${i + chunk.length} / ${mongoBlogs.length} legal articles...`);
    }
  }

  const aRes = await pClient.query('SELECT COUNT(*) FROM legal_articles;');
  console.log(`legal_articles total row count: ${aRes.rows[0].count}`);

  // Verification check: ensure 0 occurrences of ve-so.com remain in database
  const dirtyCheck = await pClient.query(`
    SELECT COUNT(*) FROM legal_articles
    WHERE content_html ILIKE '%ve-so.com%' OR summary ILIKE '%ve-so.com%';
  `);
  console.log(`Dirty ve-so.com check in PostgreSQL: ${dirtyCheck.rows[0].count} (must be 0)`);

  await mClient.close();
  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
