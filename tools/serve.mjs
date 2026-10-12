// Einfacher lokaler Server mit SPA-Fallback (wie GitHub Pages mit 404.html). Nutzung: node tools/serve.mjs [port]
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function staticHandler(root = ROOT) {
  return async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(root, p);
      if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
      let stat = await fs.stat(file).catch(() => null);
      if (stat?.isDirectory()) { file = path.join(file, 'index.html'); stat = await fs.stat(file).catch(() => null); }
      if (!stat) {
        if (path.extname(p)) { res.writeHead(404).end('Not found'); return; }
        file = path.join(root, 'index.html');
      }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
    } catch (e) { res.writeHead(500).end(String(e)); }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8080);
  http.createServer(staticHandler()).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
}
