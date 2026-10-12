// Screenshot-Check auf Handy- und Desktop-Breite. Nutzung: node tools/verify.mjs [outDir] [baseUrl]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');

const out = process.argv[2] || '/tmp/claude-0/shots';
const base = process.argv[3] || 'http://127.0.0.1:8080';
fs.mkdirSync(out, { recursive: true });

const profiles = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const problems = [];
const browser = await chromium.launch();
for (const [name, opts] of Object.entries(profiles)) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/vimeo|Failed to load resource/i.test(m.text())) problems.push(`[${name}] console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', r => { if (!/vimeo/.test(r.url())) problems.push(`[${name}] requestfailed: ${r.url()}`); });

  const shot = async (label, full = false) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${name}-${label}.png`, fullPage: full }); };
  const overflow = async (label) => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (o.sw > o.cw + 1) problems.push(`[${name}] horizontaler Überlauf auf ${label}: ${o.sw} > ${o.cw}`);
  };

  await page.goto(base + '/');
  await shot('1-intro'); await overflow('intro');
  await page.click('.intro__enter');
  await page.waitForURL('**/home', { timeout: 8000 });
  await page.waitForTimeout(2200);
  await shot('2-home'); await overflow('home');

  // Seite durchscrollen, damit Reveal-Effekte laufen, dann Vollbild
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-3-home-full.png`, fullPage: true });

  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
  await page.click('.burger'); await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${name}-4-menu.png` });
  await page.click('.menu__link[href="home#contact"]'); await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${name}-5-contact-anchor.png` });

  await page.goto(base + '/leona---festival-live-sessions');
  await page.waitForTimeout(1500);
  const h2 = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h2; y += 400) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-6-project-full.png`, fullPage: true }); await overflow('project');

  await page.goto(base + '/gibt-es-nicht'); await page.waitForTimeout(800); await shot('7-404');
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'OK – keine Konsolenfehler, kein horizontaler Überlauf');
