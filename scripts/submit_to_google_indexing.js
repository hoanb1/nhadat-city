// scripts/submit_to_google_indexing.js
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const store = require('./lib/pgStore');

// Helper to slugify title
function makeUrlSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

const keyPath = path.resolve(__dirname, '../google-service-account.json');
const dryRun = process.env.DRY_RUN === 'true';

/** New/updated public URLs in the last 24h (max 100 listings + 20 projects to respect the 200/day quota). */
async function fetchUrlsToSubmit(since = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  const urls = [];
  const { sql } = store;
  // Listings with an image; created or updated in the window
  const listings = await sql`
    SELECT short_id, mongo_id, province_slug, ward_slug, title FROM real_estates
    WHERE status >= 1 AND first_image IS NOT NULL AND (created_at >= ${since} OR updated_at >= ${since})
    LIMIT 100`;
  for (const item of listings) {
    if (item.province_slug && item.ward_slug && item.title) {
      const id = item.short_id || item.mongo_id;
      urls.push(`https://nhadat.city/${item.province_slug}/${item.ward_slug}/${id}/${makeUrlSlug(item.title)}`);
    }
  }
  const projects = await sql`
    SELECT short_id, mongo_id, title FROM projects
    WHERE created_at >= ${since} OR updated_at >= ${since}
    LIMIT 20`;
  for (const item of projects) {
    if (item.title) urls.push(`https://nhadat.city/du-an/${item.short_id || item.mongo_id}/${makeUrlSlug(item.title)}`);
  }
  return urls;
}

async function getAccessToken(clientEmail, privateKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  };

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

async function submitUrl(url, accessToken) {
  try {
    const response = await axios.post(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        url,
        type: 'URL_UPDATED',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return { success: true, url, data: response.data };
  } catch (error) {
    return { success: false, url, error: error.response?.data || error.message };
  }
}

async function run() {
  console.log(`[GOOGLE INDEXING] Bắt đầu tiến trình kiểm tra và gửi URL...`);
  if (dryRun) {
    console.log(`[GOOGLE INDEXING] [DRY RUN] Chạy thử nghiệm, sẽ không gửi API thật.`);
  }

  // 1. Load Google Service Account
  let credentials = null;
  if (!dryRun) {
    if (!fs.existsSync(keyPath)) {
      console.warn(`[GOOGLE INDEXING] [CẢNH BÁO] Không tìm thấy file key Service Account tại: ${keyPath}`);
      console.warn(`[GOOGLE INDEXING] Triển khai ở chế độ DRY RUN.`);
    } else {
      try {
        credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      } catch (err) {
        console.error(`[GOOGLE INDEXING] [LỖI] Lỗi parse file JSON key:`, err.message);
        process.exit(1);
      }
    }
  }

  // 2. Fetch URLs from Postgres (last 24h)
  let urlsToSubmit = [];

  try {
    urlsToSubmit = await fetchUrlsToSubmit();

    console.log(`[GOOGLE INDEXING] Tìm thấy ${urlsToSubmit.length} URLs mới/cập nhật từ Postgres.`);

    if (urlsToSubmit.length === 0) {
      console.log(`[GOOGLE INDEXING] Không có URL nào cần gửi.`);
      return;
    }

    // 3. Submit URLs
    if (dryRun || !credentials) {
      console.log(`\n[GOOGLE INDEXING] Danh sách URL sẽ được gửi (DRY RUN):`);
      urlsToSubmit.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
      console.log(`\n[GOOGLE INDEXING] [DRY RUN] Đã hoàn thành in thử.`);
    } else {
      console.log(`[GOOGLE INDEXING] Đang sinh access token từ Google...`);
      const accessToken = await getAccessToken(credentials.client_email, credentials.private_key);
      console.log(`[GOOGLE INDEXING] Đang gửi ${urlsToSubmit.length} URLs lên Google Indexing API...`);

      let successCount = 0;
      let failCount = 0;

      // Gửi tuần tự với delay nhỏ để tránh quá tải API
      for (let i = 0; i < urlsToSubmit.length; i++) {
        const url = urlsToSubmit[i];
        const res = await submitUrl(url, accessToken);
        if (res.success) {
          successCount++;
          console.log(`  [✓] [${i + 1}/${urlsToSubmit.length}] Gửi thành công: ${url}`);
        } else {
          failCount++;
          console.error(`  [✗] [${i + 1}/${urlsToSubmit.length}] Gửi thất bại: ${url}`, JSON.stringify(res.error));
        }
        // Delay 150ms giữa các request
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      console.log(`[GOOGLE INDEXING] Hoàn thành gửi API. Thành công: ${successCount}/${urlsToSubmit.length}, Thất bại: ${failCount}`);
    }
  } catch (err) {
    console.error(`[GOOGLE INDEXING] [LỖI]`, err.message);
  } finally {
    await store.close();
    console.log(`[GOOGLE INDEXING] Tiến trình kết thúc.`);
  }
}

if (require.main === module) run();
module.exports = { fetchUrlsToSubmit, makeUrlSlug };
