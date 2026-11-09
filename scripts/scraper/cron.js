// scripts/scraper/cron.js
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

console.log('[CRON] Khởi động tiến trình tự động cào dữ liệu và cập nhật AI ML hàng ngày.');

const scriptPath = path.resolve(__dirname, 'index.js');

function runScraper(target, jobName) {
  console.log(`[CRON] [${new Date().toISOString()}] Bắt đầu Scraping ${target} (${jobName})...`);
  const child = exec(`node ${scriptPath} "${target}" "${jobName}"`);
  
  child.stdout.on('data', (data) => process.stdout.write(`[SCRAPER ${target}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[SCRAPER ERR ${target}] ${data}`));
  
  child.on('close', (code) => {
    console.log(`[CRON] [${new Date().toISOString()}] Hoàn thành Scraping ${target} (${jobName}) với mã exit ${code}`);
  });
}

// 1. Scraping Meeyland (tin đăng) - Chạy vào 02:00 AM mỗi ngày
cron.schedule('0 2 * * *', () => {
  runScraper('meeyland', 'cron-job-daily');
});

// 2. Scraping Meeyproject (dự án) - Chạy vào 03:00 AM mỗi ngày
cron.schedule('0 3 * * *', () => {
  runScraper('meeyproject', 'cron-job-daily');
});

// 3. Scraping TinBDS (tin đăng) - Chạy vào 04:00 AM mỗi ngày
cron.schedule('0 4 * * *', () => {
  runScraper('tinbds.com', 'cron-job-daily');
});

// 4. Scraping TinBDS Dự án (dự án) - Chạy vào 05:00 AM mỗi ngày
cron.schedule('0 5 * * *', () => {
  runScraper('tinbds.com/du-an', 'cron-job-daily');
});

// 5. Scraping Alonhadat (tin đăng) - Chạy vào 05:30 AM mỗi ngày
cron.schedule('30 5 * * *', () => {
  runScraper('alonhadat.com.vn', 'cron-job-daily');
});

// 6. Tự động retraining cập nhật mô hình AI ML - Chạy vào 06:00 AM mỗi ngày
cron.schedule('0 6 * * *', () => {
  console.log(`[CRON] [${new Date().toISOString()}] Bắt đầu Cập nhật mô hình AI ML...`);
  const retrainPath = path.resolve(__dirname, '../../nhadat-ml/retrain.sh');
  const child = exec(`/bin/bash ${retrainPath}`);
  
  child.stdout.on('data', (data) => process.stdout.write(`[ML RETRAIN] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[ML RETRAIN ERR] ${data}`));
  
  child.on('close', (code) => {
    console.log(`[CRON] [${new Date().toISOString()}] Hoàn thành Cập nhật mô hình AI ML với mã exit ${code}`);
  });
});

// 7. Gửi URL mới cào được trong ngày lên Google Indexing API - Chạy vào 06:30 AM mỗi ngày
cron.schedule('30 6 * * *', () => {
  console.log(`[CRON] [${new Date().toISOString()}] Bắt đầu gửi URL lên Google Indexing API...`);
  const indexingPath = path.resolve(__dirname, '../submit_to_google_indexing.js');
  const child = exec(`node ${indexingPath}`);
  
  child.stdout.on('data', (data) => process.stdout.write(`[INDEXING] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[INDEXING ERR] ${data}`));
  
  child.on('close', (code) => {
    console.log(`[CRON] [${new Date().toISOString()}] Hoàn thành chạy Google Indexing API với mã exit ${code}`);
  });
});
