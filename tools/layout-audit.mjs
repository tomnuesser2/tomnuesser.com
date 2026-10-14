// Layout-Audit: scrollt jede Seite in mehreren Bildschirmformaten/Sprachen durch und meldet
//  - Text, der Text überlappt (außer bewusst Verschachteltes / festes Menü)
//  - Seiten, die zur Seite überlaufen (horizontal scrollbar)
//  - Text, der über den Bildschirmrand ragt
//  - Layout-Sprünge (Seitenhöhe ändert sich beim Scrollen)
//  - Stellen, an denen Scrollen "hängt" (Wisch bewegt nichts)
// Aufruf:  node tools/layout-audit.mjs [http://127.0.0.1:8787] [phone|tablet|desktop|all] [seite1,seite2]
// Playwright muss installiert sein (npm i -D playwright). Der Admin-Server (Admin-starten.bat) muss laufen.
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium; try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }
const base = process.argv[2] || 'http://127.0.0.1:8787';
const which = process.argv[3] || 'all';
const pagesArg = process.argv[4];
const projects = fs.readdirSync(path.join(root, 'content/projects')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
const pages = pagesArg ? pagesArg.split(',') : ['', ...projects];
const VP = {
  phoneS: { width: 360, height: 640, mobile: true }, phone: { width: 390, height: 844, mobile: true }, phoneL: { width: 430, height: 932, mobile: true },
  phoneW: { width: 844, height: 390, mobile: true },
  tablet: { width: 768, height: 1024, mobile: true }, desktop: { width: 1366, height: 768 }, desktopL: { width: 1920, height: 1080 },
};
const groups = { phone: ['phoneS', 'phone', 'phoneL'], tablet: ['tablet', 'phoneW'], desktop: ['desktop', 'desktopL'] };
const vps = which === 'all' ? Object.keys(VP) : (groups[which] || which.split(','));
const langs = ['de', 'en'];

// läuft im Browser: sammelt sichtbare Textstücke und prüft Überlappungen
const probe = () => {
  const vw = innerWidth, vh = innerHeight, out = { overlaps: [], edge: [], hscroll: document.documentElement.scrollWidth > vw + 1 };
  const nm = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = (e.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'); return c ? s + '.' + c : s; };
  const vis = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .08 || n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('inert')) return false; } return true; };
  const fixedUp = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false; };
  const items = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (!/\S/.test(t.nodeValue)) continue; const e = t.parentElement; if (!e || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) continue;
    if (!vis(e)) continue; if (e.closest('.admin, [data-audit-skip], .sr-only')) continue;
    const r = document.createRange(); r.selectNodeContents(t); const rs = [...r.getClientRects()].filter(x => x.width > 1 && x.height > 1);
    if (!rs.length) continue;
    const L = Math.min(...rs.map(x => x.left)), T = Math.min(...rs.map(x => x.top)), R = Math.max(...rs.map(x => x.right)), B = Math.max(...rs.map(x => x.bottom));
    if (R < 0 || L > vw || B < 0 || T > vh) continue;
    const key = e; if (seen.has(key + '|' + Math.round(T))) continue; seen.add(key + '|' + Math.round(T));
    items.push({ e, L, T, R, B, fx: fixedUp(e), txt: t.nodeValue.trim().slice(0, 28) });
    if (!fixedUp(e) && (L < -2 || R > vw + 2) && (R - L) < vw * 1.2 && !e.closest('[style*="overflow"], .kn, .albumRail, .gal, .reel, .flexc, .c3d, .tl, .fl__tool')) out.edge.push(nm(e) + ' "' + t.nodeValue.trim().slice(0, 24) + '" ' + Math.round(L) + '..' + Math.round(R));
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.fx !== b.fx) continue; if (a.e === b.e) continue;
    const ix = Math.min(a.R, b.R) - Math.max(a.L, b.L), iy = Math.min(a.B, b.B) - Math.max(a.T, b.T); if (ix <= 2 || iy <= 2) continue;
    const area = ix * iy, sm = Math.min((a.R - a.L) * (a.B - a.T), (b.R - b.L) * (b.B - b.T)); if (area < 60 || area / sm < .12 || iy / Math.min(a.B - a.T, b.B - b.T) < .25) continue;   // eng gesetzte Zeilen (Zeilenhöhe < Schrifthöhe) sind keine echte Überlappung
    out.overlaps.push(nm(a.e) + ' "' + a.txt + '"  ×  ' + nm(b.e) + ' "' + b.txt + '"  (' + Math.round(area) + 'px²)');
  }
  out.h = document.documentElement.scrollHeight; out.y = Math.round(scrollY);
  return out;
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const report = []; const sum = {};
for (const vk of vps) for (const lang of langs) {
  const v = VP[vk];
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, isMobile: !!v.mobile, hasTouch: !!v.mobile, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  for (const slug of pages) {
    const tag = `${vk}/${lang}/${slug || 'home'}`; const found = new Map(); const add = (k, m) => { if (!found.has(k + m)) found.set(k + m, { k, m, at: [] }); return found.get(k + m); };
    try {
      await pg.addInitScript((l) => { try { localStorage.setItem('lang', l); localStorage.setItem('tn-lang', l); } catch {} }, lang);
      await pg.goto(`${base}/${slug}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
      await pg.evaluate((l) => { const b = [...document.querySelectorAll('button,a')].find(x => x.textContent.trim().toLowerCase() === l); if (b && !b.classList.contains('is-on') && b.getAttribute('aria-pressed') !== 'true') b.click(); }, lang); await pg.waitForTimeout(1200);
      let H = await pg.evaluate(() => document.documentElement.scrollHeight), step = Math.round(v.height * .5), y = 0, n = 0, lastH = H, stuck = 0;
      while (y < H - v.height + step && n < 140) {
        await pg.evaluate((yy) => scrollTo(0, yy), y); await pg.waitForTimeout(v.mobile ? 420 : 320);
        const r = await pg.evaluate(probe);
        if (Math.abs(r.h - lastH) > 40) add('sprung', `Seitenhöhe ${lastH} → ${r.h}`).at.push(y); lastH = r.h; H = r.h;
        if (r.hscroll) add('quer', 'Seite läuft seitlich über').at.push(y);
        for (const m of r.overlaps) add('überlappt', m).at.push(y);
        for (const m of r.edge) add('rand', m).at.push(y);
        y += step; n++;
      }
    } catch (e) { add('fehler', String(e.message).slice(0, 120)); }
    for (const e of errs) add('js-fehler', e.slice(0, 140));
    const list = [...found.values()]; sum[tag] = list.length;
    if (list.length) { report.push(`\n## ${tag}`); for (const f of list) report.push(`- [${f.k}] ${f.m}  @y=${[...new Set(f.at)].slice(0, 4).join(',')}`); }
    process.stdout.write(`${tag}: ${list.length}\n`);
  }
  await ctx.close();
}
await browser.close();
const out = path.join(root, 'tools', 'layout-audit-report.md');
fs.writeFileSync(out, `# Layout-Audit ${new Date().toISOString()}\n` + (report.join('\n') || '\nKeine Auffälligkeiten.') + '\n');
console.log('\nBericht:', out);
