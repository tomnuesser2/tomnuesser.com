// Erzeugt content/index.json (Projektliste für die Startseite) aus content/projects/*.json.
// Reihenfolge bleibt erhalten, neue Projekte werden hinten angehängt.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildIndex(root) {
  const dir = path.join(root, 'content', 'projects');
  const file = path.join(root, 'content', 'index.json');
  let old = { order: [] };
  try { old = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  // alte, umbenannte Dateien (stehen in redirects) nicht doppelt als Projekt aufnehmen
  const slugs = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(s => !(old.redirects || {})[s]);
  const order = [...(old.order || []).filter(s => slugs.includes(s)), ...slugs.filter(s => !(old.order || []).includes(s)).sort()];
  const projects = {};
  for (const s of slugs) {
    const p = JSON.parse(await fs.readFile(path.join(dir, `${s}.json`), 'utf8'));
    const c = p.card || {};
    // Vimeo-Videos des Projekts für den Smartphone/Laptop-Block (Startseite): Karten-Video + alle Reel-Wand-Videos; hochkant → Smartphone, quer → Laptop
    const clips = [], isV = (u) => /vimeo\.com\//i.test(String(u || ''));
    if (isV(c.vimeo)) clips.push({ vimeo: c.vimeo, kind: c.ratio === '9/16' ? 'phone' : 'laptop' });
    for (const b of p.blocks || []) if (b && b.type === 'videoWall') { const kind = String((b.props || {}).format || '').startsWith('9:16') ? 'phone' : 'laptop'; for (const it of (b.props || {}).items || []) if (isV(it && it.video)) clips.push({ vimeo: it.video, kind, title: it.title || '' }); }
    projects[s] = {
      title: p.title || s, title_de: p.title_de || '', summary_de: c.summary_de || '', heroText: c.heroText || '', heroText_de: c.heroText_de || '', roles_de: c.roles_de || '', image: c.image || '', imageMobile: c.imageMobile || '', vimeo: c.vimeo || '', ratio: c.ratio || '16/9', group: c.group ?? 1, hidden: !!c.hidden, featured: !!c.featured, showcase: !!c.showcase, clips,
      summary: c.summary || '', anim: c.anim || 'expand', roles: c.roles || '', category: c.category || 'video', cam: c.cam || '',
      stills: (c.stills || []).map(x => (typeof x === 'string' ? x : x?.src)).filter(Boolean),
    };
  }
  // Weiterleitungen alter Adressen (z. B. /123 → /norder147) bleiben erhalten
  const out = { order, projects, ...(old.redirects ? { redirects: old.redirects } : {}) };
  await fs.writeFile(file, JSON.stringify(out, null, 2) + '\n');
  await writeSeo(root, out).catch((e) => console.warn('SEO-Dateien:', e.message));
  return out;
}

// ---------- SEO: echte Seiten je Projekt (Status 200 statt 404 für Google), sitemap.xml, robots.txt ----------
const SITE = 'https://tomnuesser.com/';
const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function firstText(blocks, de) {
  let f = ''; const walk = (o) => { if (f || !o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (f) return; if (typeof v === 'string' && (de ? /^(text|sideText)_de$/ : /^(text|sideText)$/).test(k) && v.trim().length > 60) f = v; else if (typeof v === 'object') walk(v); } };
  walk(blocks); if (!f && de) return firstText(blocks, false); f = f.replace(/\s+/g, ' ').trim(); return f.length > 158 ? f.slice(0, 155).replace(/\s+\S*$/, '') + ' …' : f;
}
async function writeSeo(root, out) {
  const tpl = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const live = out.order.filter(s => out.projects[s] && !out.projects[s].hidden);
  for (const s of live) {
    const pr = out.projects[s]; let blocks = [];
    try { blocks = JSON.parse(await fs.readFile(path.join(root, 'content', 'projects', `${s}.json`), 'utf8')).blocks || []; } catch {}
    const title = `${pr.title_de || pr.title} – Tom Nüßer, Videograf Flensburg`;
    const desc = pr.summary_de || firstText(blocks, true) || `${pr.title_de || pr.title} – Projekt von Tom Nüßer, Videograf und digitaler Künstler aus Flensburg.`;
    const url = SITE + s, img = pr.image ? SITE + pr.image : SITE + 'assets/icons/icon-512.png';
    const html = tpl
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(img)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
    await fs.mkdir(path.join(root, s), { recursive: true }); await fs.writeFile(path.join(root, s, 'index.html'), html);
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['', ...live].map(s => `  <url><loc>${SITE}${s}</loc><lastmod>${today}</lastmod><priority>${s ? '0.8' : '1.0'}</priority></url>`).join('\n');
  await fs.writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  await fs.writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE}sitemap.xml\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildIndex(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('index.json:', out.order.join(', '));
}
