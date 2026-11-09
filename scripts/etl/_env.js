// Tiny env loader: reads ../../.env.local (if present) and requires DATABASE_URL / MONGODB_URI.
const fs = require('fs');
const path = require('path');
try {
  const f = path.join(__dirname, '..', '..', '.env.local');
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) {}
function need(name) {
  if (!process.env[name]) throw new Error(`Missing required env var ${name} (set it in .env.local)`);
  return process.env[name];
}
module.exports = { need };
