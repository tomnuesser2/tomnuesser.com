import { ui } from '../core/i18n.js';
import { h } from '../core/dom.js';
import { mediaEl, imgFor, parseVimeo, parseYouTube, vimeoThumb } from '../core/media.js';
import { pick, names } from '../scenes/index.js';
import { mediaNode } from '../scenes/shared.js';
import { hudEl } from '../core/hud.js';
import { track, still, clamp, trackProgress } from '../core/scrollhub.js';
const pad = (n) => String(n).padStart(2, '0');

const ratioNum = (r = '16/9') => { const [a, b] = String(r).split('/').map(Number); return a && b ? a / b : 16 / 9; };

function visibleProjects(ctx, category = '') {
  return (ctx.content.index.order || [])
    .map(slug => ({ slug, ...(ctx.content.index.projects?.[slug] || {}) }))
    .filter(pr => pr.title !== undefined && !pr.hidden && (!category || category === 'all' || (pr.category || 'video') === category));
}

// Klassische Darstellung: eng gestapelte Karten, Gruppen mit größerem Abstand.
function renderStack(p, ctx) {
  const wrap = h('div', { class: 'b-projects', id: p.id });
  const groups = new Map();
  for (const pr of visibleProjects(ctx, p.category)) {
    const g = pr.group ?? 1;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(pr);
  }
  for (const list of groups.values()) {
    const grp = h('div', { class: 'p-group' });
    for (const pr of list) {
      const card = h('a', { class: 'p-card', href: pr.slug, 'data-link': '', 'aria-label': pr.title || pr.slug });
      card.append(mediaEl({ sound: false, src: imgFor(pr), vimeo: pr.vimeo, poster: pr.image ? '' : 'auto', ratio: pr.ratio || '16/9', radius: 'sm', alt: pr.title, hud: false }));
      card.querySelector('.media-play')?.remove();
      card.append(h('span', { class: 'p-card__label' }, pr.title || ''));
      grp.append(card);
    }
    wrap.append(grp);
  }
  return wrap;
}

// Scenes: Jedes Projekt ist eine Scroll-Szene mit eigener Animation (assets/js/scenes/*, pro Projekt im Admin wählbar).
// Ohne den Effekt "scenes" (oder bei reduzierter Bewegung) bleibt es eine ruhige Kartenliste.
function renderScenes(p, ctx) {
  const list = visibleProjects(ctx, p.category);
  const wrap = h('div', { class: 'scenes', id: p.id });
  list.forEach((pr, i) => {
    const anim = p.anim && p.anim !== 'project' ? p.anim : pr.anim;
    const v = pick(anim);
    wrap.append(h('section', { class: 'scene', 'data-scene': '', 'data-anim': v.name, ...(v.light ? { 'data-light': '' } : {}),
      style: { '--r': ratioNum(pr.ratio).toFixed(4), '--len': `${v.len || 240}svh` } },
      h('div', { class: 'scene__track' }, h('div', { class: 'scene__stage' }, ...v.build({ pr, i, n: list.length })))));
  });
  return wrap;
}

// Index: Eine klebende Bühne. Links die Projektliste (Nummer · Titel), rechts/oben das große Vorschaubild.
// Beim Scrollen läuft die Liste durch, das aktive Projekt zeigt Bild, Rollen und Kurztext – ein klarer roter Faden vor dem Klick.
function renderIndex(p, ctx) {
  const list = visibleProjects(ctx, p.category);
  const n = list.length;
  const imgs = list.map((pr, i) => { const m = mediaNode(pr, i, 'wi__img'); return m; });
  const rows = list.map((pr, i) => h('a', { class: 'wi__row', href: pr.slug, 'data-link': '' }, h('span', { class: 'wi__n' }, pad(i + 1)), h('span', { class: 'wi__t' }, pr.title || pr.slug)));
  const pane = h('a', { class: 'wi__pane', href: list[0]?.slug || '#', 'data-link': '', 'data-cursor': 'view', 'aria-label': ui('openProject') }, imgs, h('span', { class: 'scene__shade' }));
  const meta = h('div', { class: 'wi__meta' }, h('p', { class: 'wi__roles' }), h('p', { class: 'wi__sum' }), h('a', { class: 'wi__cta', href: list[0]?.slug || '#', 'data-link': '' }, 'open project ↗'));
  const listEl = h('div', { class: 'wi__list' }, h('div', { class: 'wi__rows' }, rows));
  const stage = h('div', { class: 'wi__stage' }, pane, h('div', { class: 'wi__side' }, listEl, meta));
  // Handy: gestapelte Vollbild-Karten (Hochformat), die beim Scrollen übereinander schieben
  const wm = h('div', { class: 'wm' }, list.map((pr, i) => h('a', { class: 'wm__card', href: pr.slug, 'data-link': '', style: { '--i': i }, 'aria-label': pr.title },
    pr.image ? h('img', { class: 'wm__img', src: imgFor(pr), alt: '', loading: i < 2 ? 'eager' : 'lazy', decoding: 'async' }) : h('span', { class: 'wm__img wm__img--ph' }),
    h('span', { class: 'wm__n' }, `${pad(i + 1)} / ${pad(n)}`), h('span', { class: 'wm__go', 'aria-hidden': 'true' }, '↗'),
    h('span', { class: 'wm__txt' }, h('span', { class: 'wm__t' }, pr.title || pr.slug),
      pr.roles ? h('span', { class: 'wm__r' }, String(pr.roles).split(',').map(x => x.trim()).filter(Boolean).slice(0, 3).join(' · ')) : null))));
  const el = h('section', { class: 'wi', id: p.id, style: { '--n': n } }, h('div', { class: 'wi__track' }, stage), wm);
  let cur = -1;
  const setCur = (i) => {
    if (i === cur) return; cur = i; const pr = list[i];
    imgs.forEach((m, k) => m.classList.toggle('is-on', k === i)); rows.forEach((r, k) => r.classList.toggle('is-on', k === i));
    pane.href = pr.slug; meta.querySelector('.wi__cta').href = pr.slug;
    meta.querySelector('.wi__roles').textContent = String(pr.roles || '').split(',').map(s => s.trim()).filter(Boolean).join(' · ');
    meta.querySelector('.wi__sum').textContent = pr.summary || '';
    meta.classList.remove('is-in'); void meta.offsetWidth; meta.classList.add('is-in');
    const t = pane.querySelector('.hud__cam'); if (t) t.textContent = pr.cam || '';
  };
  setCur(0);
  if (still() || !n) { el.classList.add('is-still'); return el; }
  const rowsEl = el.querySelector('.wi__rows');
  track(el.querySelector('.wi__track'), (r) => {
    const pr0 = trackProgress(r, stage.offsetHeight), f = pr0 * (n - 1);
    setCur(Math.round(f));
    const rh = rows[0].offsetHeight || 52;
    rowsEl.style.transform = `translate3d(0,${(-f * rh).toFixed(1)}px,0)`;
    rows.forEach((row, k) => { const d = Math.abs(k - f); row.style.opacity = String(clamp(1 - d * .28, .16, 1)); });
    el.style.setProperty('--wp', pr0.toFixed(4));
  });
  return el;
}

export default {
  type: 'projectGrid',
  label: 'Projektliste (Work)',
  fields: [
    { name: 'category', label: 'Bereich (video / social / code / design / all)', type: 'select', options: ['all', 'video', 'social', 'code', 'design'], default: 'all' },
    { name: 'mode', label: 'Darstellung', type: 'select', options: ['index', 'scenes', 'stack'], default: 'index' },
    { name: 'anim', label: 'Animation', type: 'select', options: ['project', ...names], default: 'project' },
    { name: 'note', label: 'Animation „project“ = jedes Projekt nutzt seine eigene (unter „Projekte“ einstellbar). Wählst du hier eine, nutzen alle Projekte diese.', type: 'info' },
  ],
  render(p, ctx) { if (p.mode === 'index' || !p.mode) return renderIndex(p, ctx); return p.mode === 'stack' || !document.body.classList.contains('fx-scenes') ? renderStack(p, ctx) : renderScenes(p, ctx); },
};
