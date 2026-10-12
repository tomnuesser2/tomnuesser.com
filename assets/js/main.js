import { h, svg, prefersReducedMotion } from './core/dom.js';
import { renderBlocks } from './core/registry.js';
import { startEffects, pageReady, beforeNavigate, afterNavigate } from './effects/index.js';

const ROOT = new URL('../../', import.meta.url);      // Projektwurzel (funktioniert auch unter /<repo>/)
const BASE = ROOT.pathname;
const abs = (p) => new URL(p, ROOT).href;

async function getJSON(path) {
  const r = await fetch(abs(path), { cache: 'no-cache' });
  if (!r.ok) throw Object.assign(new Error(`${path}: ${r.status}`), { status: r.status });
  return r.json();
}

const state = { site: null, index: null, els: {} };
// Vorschau-Modus (z. B. als gehostete Probe-Seite): Seitenwechsel bleiben im Speicher, die Adresszeile wird nicht verändert.
const VIRT = !!window.__VIRTUAL_ROUTER__;
let V = { pathname: location.pathname, hash: '' };
const loc = () => (VIRT ? V : location);
const push = (u) => { if (VIRT) V = { pathname: u.pathname, hash: u.hash }; else history.pushState({}, '', u); };

/* ---------- Shell ---------- */
function buildShell() {
  const { site } = state;
  const app = document.getElementById('app');

  const burger = h('button', { class: 'burger', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', 'aria-controls': 'menu' },
    svg('<svg viewBox="0 0 38 24" aria-hidden="true"><line x1="0" y1="2" x2="38" y2="2"/><line x1="13" y1="12" x2="38" y2="12"/><line x1="0" y1="22" x2="38" y2="22"/></svg>'));
  const pillLinks = (site.nav || []).map((n) => h('a', { class: 'pill__a', href: n.href, 'data-link': '' }, n.label));
  const ICO = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M10.2 9.4l4.6 2.6-4.6 2.6z" fill="currentColor" stroke="none"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5.5l-3 13"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 8l8 5.5L20 8"/></svg>'];
  const mnav = h('nav', { class: 'mnav', 'aria-label': 'Main' }, (site.nav || []).map((n, i) => { const a = h('a', { class: 'mnav__a', href: n.href, 'data-link': '' }, h('span', { class: 'mnav__i' }), h('span', { class: 'mnav__l' }, n.label)); a.querySelector('.mnav__i').innerHTML = ICO[i % ICO.length]; return a; }));
  const header = h('header', { class: 'site-header' },
    h('a', { class: 'site-header__logo', href: 'home', 'data-link': '', 'aria-label': `${site.title} – home` }, site.title),
    h('nav', { class: 'pill', 'aria-label': 'Main' }, pillLinks), mnav);

  const links = (site.nav || []).map((n, i) => h('li', {}, h('a', { class: 'menu__link', href: n.href, 'data-link': '', 'data-scramble': '1', 'data-n': String(i + 1).padStart(2, '0'), style: { '--i': i } }, n.label)));
  const close = h('button', { class: 'menu__close', type: 'button', 'aria-label': 'Close menu' },
    svg('<svg viewBox="0 0 30 30" aria-hidden="true"><line x1="2" y1="2" x2="28" y2="28"/><line x1="28" y1="2" x2="2" y2="28"/></svg>'));
  const menu = h('div', { class: 'menu', id: 'menu', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', 'aria-hidden': 'true', inert: '' },
    h('span', { class: 'menu__ghost', 'aria-hidden': 'true' }, site.title), close, h('ul', { class: 'menu__list' }, links),
    h('p', { class: 'menu__meta' }, site.tagline ? h('span', {}, site.tagline) : null, site.location ? h('span', {}, `${site.location.label} · `, h('time', { class: 'menu__time' }, '--:--:--')) : null));

  const main = h('main', { id: 'main', tabindex: '-1' });
  const footer = h('footer', { class: 'site-footer' }, h('p', {}, site.footer || ''),
    site.effects?.palette === false ? null : h('button', { class: 'kbd-hint', type: 'button', onclick: () => window.dispatchEvent(new CustomEvent('app:palette')) }, 'press ', h('kbd', {}, '⌘K'), ' to jump anywhere'));
  app.replaceChildren(header, menu, main, footer);
  Object.assign(state.els, { header, menu, main, footer, burger, close });

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
  const fmt = site.location ? new Intl.DateTimeFormat('de-DE', { timeZone: site.location.tz || 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null;
  const tickClock = () => { if (timeEl && fmt) timeEl.textContent = fmt.format(new Date()); };
  state.clock = (on) => { clearInterval(clock); if (on) { tickClock(); clock = setInterval(tickClock, 1000); } };
  burger.addEventListener('click', () => setMenu(true));
  close.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });
}

function spy() {
  const links = [...document.querySelectorAll('.pill__a, .mnav__a')];
  let cur = null;
  for (const a of links) {
    const u = new URL(a.getAttribute('href'), location.href);
    const el = u.hash && u.pathname === loc().pathname ? document.getElementById(decodeURIComponent(u.hash.slice(1))) : null;
    if (el && el.getBoundingClientRect().top < innerHeight * .45) cur = a;
  }
  const ch = cur && cur.getAttribute('href'); links.forEach(a => a.classList.toggle('is-active', !!ch && a.getAttribute('href') === ch));
}
const dock = () => { const hd = document.querySelector('.site-header'); if (!hd) return; hd.classList.toggle('is-docked', scrollY > 70);
  const dark = [...document.querySelectorAll('.kn__stage')].some(e => { const r = e.getBoundingClientRect(); return r.top < 36 && r.bottom > 36; }); hd.classList.toggle('over-dark', dark);
  const fl = [...document.querySelectorAll('.fl__stage')].some(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight * .6 && r.bottom > innerHeight * .4; }); hd.classList.toggle('mnav-off', fl); };
addEventListener('scroll', () => requestAnimationFrame(() => { spy(); dock(); }), { passive: true });

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
    h('p', { class: 'intro__copy' }, site.footer || ''));
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
    page = { title: 'Not found', blocks: [
      { type: 'spacer', props: { size: 60 } },
      { type: 'heading', props: { text: '404', level: 1, align: 'center', bold: true } },
      { type: 'text', props: { text: 'This page does not exist.', align: 'center' } },
    ] };
  }
  const ctx = { site, content: { index: state.index }, route: target };
  const frag = h('div', { class: 'page', 'data-page': target });
  frag.append(renderBlocks(page.blocks, ctx), h('div', { class: 'b-spacer', style: { '--h': '40px' } }));
  els.main.replaceChildren(frag);
  setMeta(page.title);
  window.scrollTo(0, 0);
  state.els.header.classList.remove('is-hidden');
  markActiveLinks();
  pageReady(els.main);
  if (loc().hash) requestAnimationFrame(() => scrollToHash(loc().hash, false));
}

function scrollToHash(hash, smooth = true) {
  const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!el) return;
  const y = el.getBoundingClientRect().top + scrollY - 70;
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
    state.site = site; state.index = index;
  } catch (e) {
    document.getElementById('app').textContent = 'Could not load site content.';
    console.error(e); return;
  }
  const t = state.site.theme || {};
  for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty(`--${k}`, v);
  buildShell();
  startEffects(state.site.effects, { site: state.site, index: state.index });
  console.log('%c tom nuesser %c videographer · designer · developer ', 'background:#000;color:#fff;padding:4px 6px;border-radius:4px 0 0 4px', 'background:#f33;color:#fff;padding:4px 6px;border-radius:0 4px 4px 0');
  console.log('psst: ⌘K / ctrl+K opens the command palette.');
  await render();
}
boot();
