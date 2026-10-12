// Wird beim Veröffentlichen (GitHub Action) auf den fertigen _site-Ordner angewendet:
// hängt an alle CSS- und JS-Dateien eine Versionsnummer (?v=…) an, damit Handys nach jedem Update sofort die neue Version laden
// und nicht eine alte aus dem Zwischenspeicher. Aufruf: node tools/stamp.mjs <ordner> <version>
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const [dir = '_site', ver0 = String(Date.now())] = process.argv.slice(2);
const v = String(ver0).slice(0, 10);
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const js = walk(join(dir, 'assets', 'js')).filter((f) => f.endsWith('.js')).map((f) => './' + relative(dir, f).split('\\').join('/'));
const map = { imports: Object.fromEntries(js.map((u) => [u, `${u}?v=${v}`])) };
for (const page of ['index.html', '404.html']) {
  const f = join(dir, page); let html; try { html = readFileSync(f, 'utf8'); } catch { continue; }
  html = html.replace(/(href="assets\/css\/[^"?]+\.css)"/g, `$1?v=${v}"`).replace(/(src="assets\/js\/main\.js)"/g, `$1?v=${v}"`);
  // Import-Map muss VOR dem ersten Modul stehen (nach dem Basispfad-Skript)
  html = html.replace('<script type="module"', `<script type="importmap">${JSON.stringify(map)}</script>\n<script type="module"`);
  writeFileSync(f, html);
}
console.log(`stamp: ${js.length} Skripte, Version ${v}`);
