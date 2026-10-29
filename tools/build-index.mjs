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
  const slugs = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
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
  const out = { order, projects };
  await fs.writeFile(file, JSON.stringify(out, null, 2) + '\n');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildIndex(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('index.json:', out.order.join(', '));
}
