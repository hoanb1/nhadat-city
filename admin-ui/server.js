import express from 'express';
import proxy from 'express-http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Proxy API requests to Next.js
app.use('/api', proxy('http://localhost:3000', {
  proxyReqPathResolver: function (req) {
    return '/api' + req.url; // Append /api back to the path
  }
}));

// Serve static Vite output
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for React Router
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Admin UI running at http://localhost:${PORT}`);
});
