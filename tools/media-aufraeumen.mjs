// Verschiebt UNBENUTZTE Dateien aus media/ nach media/_unbenutzt/ (nichts wird gelöscht – zurückverschieben genügt).
// Als „benutzt“ gilt jede Datei, deren Name in content/**/*.json, index.html, 404.html, manifest.webmanifest oder assets/**/*.{js,css} vorkommt.
// Aufruf:  node tools/media-aufraeumen.mjs          → nur anzeigen (Probelauf)
//          node tools/media-aufraeumen.mjs --los    → wirklich verschieben
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media'), OUT = path.join(MEDIA, '_unbenutzt');
const GO = process.argv.includes('--los');

async function walk(dir, exts, acc = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, exts, acc); else if (exts.some((x) => e.name.toLowerCase().endsWith(x))) acc.push(p);
  }
  return acc;
}
const textFiles = [...await walk(path.join(ROOT, 'content'), ['.json']), ...await walk(path.join(ROOT, 'assets'), ['.js', '.css'])];
for (const f of ['index.html', '404.html', 'manifest.webmanifest']) textFiles.push(path.join(ROOT, f));
let corpus = '';
for (const f of textFiles) { try { corpus += '\n' + await fs.readFile(f, 'utf8'); } catch { /* fehlt */ } }
try { corpus += '\n' + decodeURIComponent(corpus.replace(/%(?![0-9a-f]{2})/gi, '%25')); } catch { /* egal */ }
corpus = corpus.replace(/\\\//g, '/');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const used = (name) => new RegExp('(?<![\\w.%-])' + esc(name) + '(?![\\w])', 'i').test(corpus);

const items = await fs.readdir(MEDIA, { withFileTypes: true });
const move = [], keep = [];
let bytes = 0;
for (const e of items) {
  if (e.name === '_unbenutzt') continue;
  const p = path.join(MEDIA, e.name);
  if (e.isDirectory()) {
    // Ordner (z. B. Bildfolgen) bleibt, sobald irgendwo auf „media/<ordner>/“ verwiesen wird
    const hit = new RegExp('media/' + esc(e.name) + '/', 'i').test(corpus);
    const size = (await walk(p, [''])).length;
    (hit ? keep : move).push({ name: e.name + '/', p, dir: true, size: 0, files: size });
    continue;
  }
  const st = await fs.stat(p);
  (used(e.name) ? keep : move).push({ name: e.name, p, size: st.size });
}
for (const m of move) bytes += m.size;
console.log(`benutzt: ${keep.length}   unbenutzt: ${move.length}   (${(bytes / 1048576).toFixed(1)} MB + Ordner)`);
for (const m of move) console.log('  ' + (GO ? 'verschiebe ' : 'würde verschieben ') + m.name + (m.dir ? `  (${m.files} Dateien)` : `  (${(m.size / 1024).toFixed(0)} KB)`));
if (GO) {
  await fs.mkdir(OUT, { recursive: true });
  for (const m of move) await fs.rename(m.p, path.join(OUT, path.basename(m.p)));
  console.log(`\nFertig. Alles liegt jetzt in media/_unbenutzt/. Seite testen – wenn alles passt, den Ordner löschen (oder in .gitignore).`);
} else console.log('\nNur Probelauf. Zum Verschieben:  node tools/media-aufraeumen.mjs --los');
