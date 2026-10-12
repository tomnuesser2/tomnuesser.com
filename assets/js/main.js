import { videoCfg } from './core/media.js';
import { h, svg, prefersReducedMotion } from './core/dom.js';
import { renderBlocks } from './core/registry.js';
import { localize, getLang, setLang, ui } from './core/i18n.js';
import { startEffects, pageReady, beforeNavigate, afterNavigate } from './effects/index.js';

const ROOT = new URL('../../', import.meta.url);      // Projektwurzel (funktioniert auch unter /<repo>/)
const BASE = ROOT.pathname;
const abs = (p) => new URL(p, ROOT).href;

async function getJSON(path) {
  const r = await fetch(abs(path), { cache: 'no-cache' });
  if (!r.ok) throw Object.assign(new Error(`${path}: ${r.status}`), { status: r.status });
  return r.json();
}

const state = { site: null, index: null, raw: null, fx: {}, els: {} };
function applyLang() { state.site = localize(state.raw.site); Object.assign(videoCfg, state.site.video || {}); state.index = localize(state.raw.index); state.fx.site = state.site; state.fx.index = state.index; }
// Vorschau-Modus (z. B. als gehostete Probe-Seite): Seitenwechsel bleiben im Speicher, die Adresszeile wird nicht verändert.
const VIRT = !!window.__VIRTUAL_ROUTER__;
let V = { pathname: location.pathname, hash: '' };
const loc = () => (VIRT ? V : location);
const push = (u) => { if (VIRT) V = { pathname: u.pathname, hash: u.hash }; else history.pushState({}, '', u); };

const MQ = matchMedia('(max-width: 899px)');

/* ---------- Sprachumschalter ---------- */
function langSwitch(cls) {
  const cur = getLang();
  const box = h('div', { class: `lang ${cls}`, role: 'group', 'aria-label': ui('language'), 'data-l': cur }, h('i', { class: 'lang__t', 'aria-hidden': 'true' }));
  ['de', 'en'].forEach((l, i) => {
    if (i) box.append(h('span', { 'aria-hidden': 'true' }, '/'));
    box.append(h('button', { type: 'button', class: 'lang__b', 'data-lang': l, 'aria-pressed': String(cur === l), lang: l, onclick: () => {
      if (l === getLang()) return;
      box.dataset.l = l;                                             // Schieber läuft sofort rüber
      if (MQ.matches) setTimeout(() => switchLang(l), 280); else switchLang(l);
    } }, l.toUpperCase()));
  });
  return box;
}
async function switchLang(l) {
  if (l === getLang()) return;
  const y = scrollY;
  setLang(l); applyLang(); buildShell(); await render();
  window.scrollTo(0, y);
}

/* ---------- Shell ---------- */
function buildShell() {
  const { site } = state;
  const app = document.getElementById('app');

  const burger = h('button', { class: 'burger', type: 'button', 'aria-label': ui('openMenu'), 'aria-expanded': 'false', 'aria-controls': 'menu' },
    svg('<svg viewBox="0 0 38 24" aria-hidden="true"><line x1="0" y1="2" x2="38" y2="2"/><line x1="13" y1="12" x2="38" y2="12"/><line x1="0" y1="22" x2="38" y2="22"/></svg>'));
  const pillLinks = (site.nav || []).map((n) => h('a', { class: 'pill__a', href: n.href, 'data-link': '' }, n.label));
  const ICO = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M10.2 9.4l4.6 2.6-4.6 2.6z" fill="currentColor" stroke="none"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5.5l-3 13"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.9 5.4 5.6 2.1-5.6 2.1L12 18.5l-1.9-5.4L4.5 11l5.6-2.1z"/><path d="M18.5 3.5v3M17 5h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 8l8 5.5L20 8"/></svg>'];
  const mnav = h('nav', { class: 'mnav', 'aria-label': ui('main') }, (site.nav || []).map((n, i) => { const a = h('a', { class: 'mnav__a', href: n.href, 'data-link': '' }, h('span', { class: 'mnav__i' }), h('span', { class: 'mnav__l' }, n.label)); a.querySelector('.mnav__i').innerHTML = ICO[i % ICO.length]; return a; }));
  const header = h('header', { class: 'site-header' },
    h('a', { class: 'site-header__logo', href: 'home', 'data-link': '', 'aria-label': `${site.title} – ${ui('home')}` }, site.title),
    h('nav', { class: 'pill', 'aria-label': ui('main') }, pillLinks), mnav, langSwitch('lang--head'));

  const links = (site.nav || []).map((n, i) => h('li', {}, h('a', { class: 'menu__link', href: n.href, 'data-link': '', 'data-scramble': '1', 'data-n': String(i + 1).padStart(2, '0'), style: { '--i': i } }, n.label)));
  const close = h('button', { class: 'menu__close', type: 'button', 'aria-label': ui('closeMenu') },
    svg('<svg viewBox="0 0 30 30" aria-hidden="true"><line x1="2" y1="2" x2="28" y2="28"/><line x1="28" y1="2" x2="2" y2="28"/></svg>'));
  const menu = h('div', { class: 'menu', id: 'menu', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', 'aria-hidden': 'true', inert: '' },
    h('span', { class: 'menu__ghost', 'aria-hidden': 'true' }, site.title), close, langSwitch('lang--menu'), h('ul', { class: 'menu__list' }, links),
    h('p', { class: 'menu__meta' }, site.tagline ? h('span', {}, site.tagline) : null, site.location ? h('span', {}, `${site.location.label} · `, h('time', { class: 'menu__time' }, '--:--:--')) : null));

  const main = h('main', { id: 'main', tabindex: '-1' });
  const footer = h('footer', { class: 'site-footer' }, h('p', {}, site.footer || ''), langSwitch('lang--foot'),
    site.effects?.palette === false ? null : h('button', { class: 'kbd-hint', type: 'button', onclick: () => window.dispatchEvent(new CustomEvent('app:palette')) }, ui('pressKey') + ' ', h('kbd', {}, '⌘K'), ' ' + ui('jumpAnywhere')));
  app.replaceChildren(header, menu, main, footer);
  Object.assign(state.els, { header, menu, main, footer, burger, close });
  measureNav(); document.fonts?.ready.then(measureNav);

  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
    state.clock(open);
    if (open) close.focus(); else if (document.activeElement && menu.contains(document.activeElement)) burger.focus();
  };
  state.setMenu = setMenu;
  let clock;
  const timeEl = menu.querySelector('.menu__time');
  const fmt = site.location ? new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { timeZone: site.location.tz || 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null;
  const tickClock = () => { if (timeEl && fmt) timeEl.textContent = fmt.format(new Date()); };
  state.clock = (on) => { clearInterval(clock); if (on) { tickClock(); clock = setInterval(tickClock, 1000); } };
  burger.addEventListener('click', () => setMenu(true));
  close.addEventListener('click', () => setMenu(false));
  if (!state.escBound) { state.escBound = true; addEventListener('keydown', (e) => { const m = state.els.menu; if (e.key === 'Escape' && m && m.classList.contains('is-open')) state.setMenu(false); }); }
}

let spyMap = null, spyKey = '';
function spy() {
  // Ziele der Menülinks nur einmal ermitteln (nicht bei jedem Scroll neu parsen/suchen)
  const links = [...document.querySelectorAll('.pill__a, .mnav__a')], key = links.length + loc().pathname;
  if (!spyMap || spyKey !== key || spyMap.some(([, el]) => el && !el.isConnected)) {
    spyKey = key;
    spyMap = links.map((a) => { const u = new URL(a.getAttribute('href'), location.href); return [a, u.hash && u.pathname === loc().pathname ? document.getElementById(decodeURIComponent(u.hash.slice(1))) : null]; });
  }
  let cur = null; const lim = innerHeight * .45;
  for (const [a, el] of spyMap) if (el && el.getBoundingClientRect().top < lim) cur = a;
  const ch = cur && cur.getAttribute('href'); for (const a of links) a.classList.toggle('is-active', !!ch && a.getAttribute('href') === ch);
}
// Beschriftungen des unteren Menüs: genaue Breite messen, damit nichts aus der Pille rutscht
function measureNav() {
  const nav = document.querySelector('.mnav'); if (!nav) return;
  // Schriftgröße der Leiste so wählen, dass alle Wörter in die Bildschirmbreite passen (möglichst groß, nie abgeschnitten)
  nav.style.setProperty('--nfs', '14px');
  const ls = [...nav.querySelectorAll('.mnav__l')], words = ls.reduce((a, l) => a + l.scrollWidth, 0), n = ls.length || 1;
  const need = words + n * 14 * 1.1 + 12, avail = Math.min(innerWidth, 640) - 20;
  nav.style.setProperty('--nfs', Math.max(8.4, Math.min(15, 14 * avail / need)).toFixed(2) + 'px');
  ls.forEach((l) => l.style.setProperty('--w', Math.ceil(l.scrollWidth) + 3 + 'px'));
}
addEventListener('resize', measureNav);

// Handy: Sobald der NOTUA-Flug am Bildschirm "klebt", verwandelt sich die Menü-Pille in die NOTUA-Leiste – und danach wieder zurück.
let flOn = false, morphTok = 0, morphAnim = [];
const flPinned = () => { if (!MQ.matches) return false; const t = document.querySelector('.fl__track'), s = document.querySelector('.fl__stage'); if (!t || !s) return false; const a = t.getBoundingClientRect(), b = s.getBoundingClientRect(); return a.top <= 1 && a.bottom >= b.height - 1 && Number(s.dataset.st || 0) >= 1; }; // NOTUA-Leiste erst ab „Notizen 1“ (nicht schon beim Logo)
async function morph(on) {
  const hd = document.querySelector('.site-header'), nav = document.querySelector('.mnav'), dk = document.querySelector('.fl__dock');
  const tok = ++morphTok; morphAnim.forEach((a) => { try { a.cancel(); } catch { /* weg */ } }); morphAnim = [];
  if (!hd || !nav || !dk || prefersReducedMotion() || !nav.animate) { hd?.classList.toggle('mnav-off', on); document.body.classList.toggle('fl-pinned', on); return; }
  const cs = getComputedStyle(dk), D = 520, ease = 'cubic-bezier(.65,0,.25,1)';
  const kids = [...nav.children];
  if (on) {
    const A = nav.getBoundingClientRect(), B = dk.getBoundingClientRect(), dy = (B.top + B.height / 2) - (A.top + A.height / 2);
    const fromBg = getComputedStyle(nav).backgroundColor, fromR = getComputedStyle(nav).borderRadius;
    morphAnim = [
      nav.animate([{ width: A.width + 'px', height: A.height + 'px', transform: 'translateX(-50%)', borderRadius: fromR, backgroundColor: fromBg }, { width: B.width + 'px', height: B.height + 'px', transform: `translateX(-50%) translateY(${dy}px)`, borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor }], { duration: D, easing: ease, fill: 'forwards' }),
      ...kids.map((k) => k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D * .4, easing: 'ease-out', fill: 'forwards' })),
    ];
    await morphAnim[0].finished.catch(() => {}); if (tok !== morphTok) return;
    document.body.classList.add('fl-pinned'); hd.classList.add('mnav-off');
    morphAnim.forEach((a) => a.cancel()); morphAnim = [];
  } else {
    const A = dk.getBoundingClientRect();
    document.body.classList.remove('fl-pinned'); hd.classList.remove('mnav-off');
    const B = nav.getBoundingClientRect(), dy = (A.top + A.height / 2) - (B.top + B.height / 2);
    morphAnim = [
      nav.animate([{ width: A.width + 'px', height: A.height + 'px', transform: `translateX(-50%) translateY(${dy}px)`, borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor }, { width: B.width + 'px', height: B.height + 'px', transform: 'translateX(-50%)', borderRadius: getComputedStyle(nav).borderRadius, backgroundColor: getComputedStyle(nav).backgroundColor }], { duration: D, easing: ease }),
      ...kids.map((k) => k.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], { duration: D, easing: 'ease-in' })),
    ];
    await morphAnim[0].finished.catch(() => {}); morphAnim = [];
  }
}
const dock = () => { const hd = document.querySelector('.site-header'); if (!hd) return; hd.classList.toggle('is-docked', scrollY > 70);
  const dark = [...document.querySelectorAll('.kn__stage, .hm__stage.is-dark')].some(e => { const r = e.getBoundingClientRect(); return r.top < 36 && r.bottom > 36; }); hd.classList.toggle('over-dark', dark);
  { const c = document.getElementById('contact'); const r = c && c.getBoundingClientRect(); hd.classList.toggle('at-contact', !!r && r.top < innerHeight * .55 && r.bottom > 0); } // Kontakt: Logo und Sprachumschalter ausblenden
  const on = flPinned(); if (on !== flOn) { flOn = on; morph(on); } else if (on && !morphAnim.length) { hd.classList.add('mnav-off'); document.body.classList.add('fl-pinned'); } };
addEventListener('tn-dark', () => dock());
let spyQ = false;
addEventListener('scroll', () => { if (spyQ) return; spyQ = true; requestAnimationFrame(() => { spyQ = false; spy(); dock(); }); }, { passive: true });

function markActiveLinks() {
  spy(); dock();
  const here = loc().pathname + loc().hash;
  state.els.menu.querySelectorAll('.menu__link').forEach((a) => {
    const u = new URL(a.getAttribute('href'), location.href);
    a.classList.toggle('is-active', u.pathname + u.hash === here || false);
  });
}

/* ---------- Seiten ---------- */
const routeSlug = () => decodeURIComponent(loc().pathname.slice(BASE.length)).replace(/^\/+|\/+$/g, '');

async function loadPage(slug) {
  for (const dir of ['pages', 'projects']) {
    try { return await getJSON(`content/${dir}/${slug}.json`); } catch (e) { if (e.status !== 404) throw e; }
  }
  return null;
}

function setMeta(title) {
  document.title = title && title !== state.site.title ? `${title} – ${state.site.title}` : state.site.title;
}

function renderIntro() {
  document.body.classList.add('is-intro');
  const { site, els } = state;
  els.main.replaceChildren();
  const btn = h('a', { class: 'intro__enter', href: 'home', 'data-link': 'intro', 'data-magnetic': '1' }, site.intro?.button || 'enter');
  const intro = h('section', { class: 'intro' },
    h('div', { class: 'intro__center' }, h('h1', { class: 'intro__name', 'data-scramble': 'load' }, site.title),
      site.tagline ? h('p', { class: 'intro__tag', 'data-scramble': 'load' }, site.tagline) : null, btn),
    h('p', { class: 'intro__copy' }, site.footer || ''), langSwitch('lang--intro'));
  els.main.append(intro);
  setMeta(site.title);
  pageReady(els.main);
}

async function render() {
  const { els, site } = state;
  const slug = routeSlug();
  if (slug === '' && site.intro?.enabled !== false) { renderIntro(); window.scrollTo(0, 0); return; }
  document.body.classList.remove('is-intro');

  const target = slug === '' ? 'home' : slug;
  let page = null;
  try { page = await loadPage(target); } catch (e) { console.error(e); }
  if (!page) {
    page = { title: ui('notFound'), blocks: [
      { type: 'spacer', props: { size: 60 } },
      { type: 'heading', props: { text: '404', level: 1, align: 'center', bold: true } },
      { type: 'text', props: { text: ui('notFoundText'), align: 'center' } },
    ] };
  }
  // Projektseite: Hat das Projekt einen Video-Link (Vimeo/YouTube) auf der Karte, aber das erste Bild/Video-Element hat keinen eigenen, wird der Karten-Link dort abgespielt
  { const pv = state.index && state.index.projects && state.index.projects[target] && state.index.projects[target].vimeo;
    const m1 = pv && (page.blocks || []).find(b => b.type === 'media');
    if (m1 && m1.props && !m1.props.vimeo) page = { ...page, blocks: page.blocks.map(b => b === m1 ? { ...b, props: { ...b.props, vimeo: pv } } : b) }; }
  document.body.classList.toggle('is-sub', target !== 'home'); document.querySelector('.mnav')?.classList.remove('is-open');
  const ctx = { site, content: { index: state.index }, route: target };
  const frag = h('div', { class: 'page', 'data-page': target });
  frag.append(renderBlocks(page.blocks, ctx), h('div', { class: 'b-spacer', style: { '--h': '40px' } }));
  els.main.replaceChildren(frag);
  setMeta((getLang() === 'de' && page.title_de) || page.title);
  window.scrollTo(0, 0);
  state.els.header.classList.remove('is-hidden');
  markActiveLinks();
  pageReady(els.main);
  if (loc().hash) requestAnimationFrame(() => scrollToHash(loc().hash, false));
}

function scrollToHash(hash, smooth = true) {
  const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!el) return;
  // Der NOTUA-Flug klebt am Bildschirm: Menüsprung landet genau auf seinem Start (Logo), nicht davor
  let y = el.getBoundingClientRect().top + scrollY - (el.querySelector('.fl__track') ? -2 : 70);
  // Kreatives (Kinetic-Abschnitt): direkt dorthin springen, wo der Button „meine aktuellen Design-Arbeiten“ schon voll zu sehen ist
  const kt = el.querySelector('.kn__track') || (el.classList.contains('kn__track') ? el : null);
  if (kt) y = kt.getBoundingClientRect().top + scrollY + .17 * Math.max(0, kt.offsetHeight - innerHeight);
  window.scrollTo({ top: y, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
}

/* ---------- Navigation ---------- */
let navigating = false;
async function navigate(href, { intro = false, label = '' } = {}) {
  const u = new URL(href, location.href);
  if (u.origin !== location.origin) { location.href = u.href; return; }
  if (navigating) return;
  state.setMenu(false);
  if (u.pathname === loc().pathname && !intro) {
    if (u.hash) { push(u); await sectionJump(u.hash, label); markActiveLinks(); }
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  navigating = true;
  try {
    if (intro) await introTransition(u);
    else {
      await beforeNavigate();
      push(u);
      await render();
      await afterNavigate();
    }
  } finally { navigating = false; }
}

// Menü-Klick: dunkler Vorhang fährt hoch, zeigt kurz den Namen des Ziels, springt dahinter zum Abschnitt und fährt wieder weg.
async function sectionJump(hash, label) {
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;
  if (prefersReducedMotion() || !document.body.animate || navigating) { scrollToHash(hash); return; }
  navigating = true;
  const word = h('span', { class: 'jump__w' }, label || '');
  const veil = h('div', { class: 'jump' }, h('span', { class: 'jump__n' }, '→'), word);
  document.body.append(veil);
  const ease = 'cubic-bezier(.76,0,.24,1)';
  try {
    await veil.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, easing: ease, fill: 'forwards' }).finished;
    word.animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    scrollToHash(hash, false);
    await new Promise(r => setTimeout(r, 520));
    scrollToHash(hash, false);
    await veil.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 620, easing: ease, fill: 'forwards' }).finished;
  } finally { veil.remove(); navigating = false; }
}

async function introTransition(u) {
  const btn = document.querySelector('.intro__enter');
  if (prefersReducedMotion() || !btn || !document.body.animate) { push(u); await render(); return; }
  const r = btn.getBoundingClientRect();
  const veil = h('div', { class: 'intro__veil' });
  document.body.append(veil);
  const at = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  await veil.animate([{ clipPath: `circle(0px at ${at})` }, { clipPath: `circle(150vmax at ${at})` }], { duration: 900, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished;
  push(u);
  await render();
  await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease', fill: 'forwards' }).finished;
  veil.remove();
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[data-link]');
  if (!a) return;
  e.preventDefault();
  navigate(a.getAttribute('href'), { intro: a.dataset.link === 'intro', label: (a.querySelector('.mnav__l') || a).textContent.trim() });
});
addEventListener('popstate', () => { render(); });
addEventListener('app:navigate', (e) => navigate(e.detail.href));

/* ---------- Start ---------- */
async function boot() {
  try {
    const [site, index] = await Promise.all([getJSON('content/site.json'), getJSON('content/index.json')]);
    state.raw = { site, index }; applyLang();
  } catch (e) {
    document.getElementById('app').textContent = ui('loadFail');
    console.error(e); return;
  }
  const t = state.site.theme || {};
  for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty(`--${k}`, v);
  buildShell();
  startEffects(state.site.effects, state.fx);
  console.log('%c tom nuesser %c videographer · designer · developer ', 'background:#000;color:#fff;padding:4px 6px;border-radius:4px 0 0 4px', 'background:#f33;color:#fff;padding:4px 6px;border-radius:0 4px 4px 0');
  console.log('psst: ⌘K / ctrl+K opens the command palette.');
  await render();
}
boot();

// Handy, Unterseiten: Menü ist eine feste dunkle Pille mit Icons. Tippen fährt sie nach links und rechts aus (mit Text), der nächste Tipp auf einen Punkt geht dorthin und fährt sie wieder ein.
{
  const mn = () => document.querySelector('.mnav');
  const sub = () => document.body.classList.contains('is-sub') && matchMedia('(max-width: 899px)').matches;
  document.addEventListener('click', (e) => {
    const nav = mn(); if (!nav || !sub()) return;
    if (nav.contains(e.target)) {
      if (!nav.classList.contains('is-open')) { e.preventDefault(); e.stopPropagation(); nav.classList.add('is-open'); }
      else nav.classList.remove('is-open');
    } else nav.classList.remove('is-open');
  }, true);
  addEventListener('scroll', () => { const n = mn(); if (n && n.classList.contains('is-open')) n.classList.remove('is-open'); }, { passive: true });
}
