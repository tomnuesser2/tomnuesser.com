import { h } from '../core/dom.js';
import { track, still } from '../core/scrollhub.js';
import { imgFor } from '../core/media.js';

// Reel-Galerie: schräg gestellte Bildreihen, die beim Scrollen in wechselnde Richtungen gleiten.
const ITEM = [
  { name: 'image', label: '💻 Bild (Computer)', type: 'image' },
  { name: 'imageMobile', label: '📱 Bild für Smartphone (leer = wie Computer)', type: 'image' },
  { name: 'title', label: 'Titel (optional, erscheint beim Darüberfahren)', type: 'text' },
  { name: 'link', label: 'Link beim Anklicken (optional, z. B. ein Projekt-Name)', type: 'text' },
];
const ASPECTS = {
  gemischt: [1.5, .8, 1.78, .75, 1.33, 1, 1.6, .8],
  quer: [1.5, 1.78, 1.33, 1.6],
  hochkant: [.75, .8, .67, .8],
  quadrat: [1],
};
const goto = (href) => { if (!href) return; const a = document.createElement('a'); a.href = href; a.setAttribute('data-link', ''); a.hidden = true; document.body.append(a); a.click(); a.remove(); };
const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));

export default {
  type: 'reelGallery',
  label: 'Reel-Galerie (schräge Bildreihen, gleiten beim Scrollen)',
  fields: [
    { name: 'source', label: 'Inhalt', type: 'select', options: ['eigene Bilder', 'alle Projekte'], default: 'eigene Bilder' },
    { name: 'items', label: 'Bilder (je mehr, desto abwechslungsreicher)', type: 'list', itemFields: ITEM, default: [] },
    { name: 'height', label: 'Höhe am PC in px', type: 'number', default: 860 },
    { name: 'heightMobile', label: '📱 Höhe am Smartphone in px', type: 'number', default: 560 },
    { name: 'rows', label: 'Anzahl Reihen (PC)', type: 'number', default: 5 },
    { name: 'rowsMobile', label: '📱 Anzahl Reihen (Smartphone)', type: 'number', default: 4 },
    { name: 'tilt', label: 'Schräglage in Grad (0 = gerade)', type: 'number', default: 8 },
    { name: 'tilt3d', label: '3D-Neigung in Grad (0 = flach)', type: 'number', default: 0 },
    { name: 'speed', label: 'Gleit-Stärke beim Scrollen (0 = keine, 1 = normal)', type: 'number', default: 1 },
    { name: 'drift', label: 'Dauerhaftes Eigentempo in px pro Sekunde (0 = nur beim Scrollen)', type: 'number', default: 0 },
    { name: 'gap', label: 'Abstand zwischen Bildern in px', type: 'number', default: 14 },
    { name: 'radius', label: 'Rundung der Bilder in px', type: 'number', default: 14 },
    { name: 'format', label: 'Bildformate', type: 'select', options: ['gemischt', 'quer', 'hochkant', 'quadrat'], default: 'gemischt' },
    { name: 'width', label: 'Breite', type: 'select', options: ['Rahmen', 'volle Breite'], default: 'Rahmen' },
    { name: 'fade', label: 'Ränder weich ausblenden', type: 'checkbox', default: true },
    { name: 'hover', label: 'Bild beim Darüberfahren hervorheben', type: 'checkbox', default: true },
    { name: 'bg', label: 'Hintergrund', type: 'select', options: ['dunkel', 'hell'], default: 'dunkel' },
  ],
  render(p0, ctx) {
    const p = { source: 'eigene Bilder', height: 860, heightMobile: 560, rows: 5, rowsMobile: 4, tilt: 8, tilt3d: 0, speed: 1, drift: 0, gap: 14, radius: 14, format: 'gemischt', width: 'Rahmen', fade: true, hover: true, bg: 'dunkel', ...p0 };
    let items;
    if (p.source === 'alle Projekte') {
      const idx = ctx.content.index;
      items = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden)
        .map(x => ({ src: imgFor(x), title: String(x.title || x.slug).replace(/\n/g, ' '), href: x.slug }));
    } else items = (p.items || []).filter(i => i.image).map(i => ({ src: imgFor(i), title: i.title || '', href: i.link || '' }));

    const el = h('div', { class: `b-reel${p.bg === 'hell' ? ' b-reel--light' : ''}${p.width === 'volle Breite' ? ' b-reel--full' : ''}${p.fade ? ' has-fade' : ''}${p.hover ? ' has-hover' : ''}` });
    if (items.length < 2) { el.append(h('p', { class: 'b-reel__empty' }, 'Mindestens 2 Bilder hinzufügen.')); el.style.height = '200px'; return el; }
    const stage = h('div', { class: 'b-reel__stage' }); el.append(stage);
    const rowsEls = []; let built = '';

    const build = () => {
      const mob = innerWidth < 760;
      const W = el.clientWidth, H = num(mob ? p.heightMobile : p.height, mob ? 560 : 860);
      el.style.height = H + 'px';
      if (W < 10) return;
      const key = [W, H, mob].join('|'); if (key === built) return; built = key;
      const gap = Math.max(0, num(p.gap, 14)), rows = Math.max(1, Math.round(num(mob ? p.rowsMobile : p.rows, 5)));
      const tilt = num(p.tilt, 8) * (mob ? .7 : 1), t3 = num(p.tilt3d, 0);
      const rad = Math.abs(tilt) * Math.PI / 180;
      // Bühne so groß, dass sie nach dem Kippen den Rahmen immer komplett füllt
      const SW = W * Math.cos(rad) + H * Math.sin(rad) + gap * 2 + 200, SH = H * Math.cos(rad) + W * Math.sin(rad) + gap * 2 + 40;
      const cardH = Math.max(40, (SH - gap * (rows - 1)) / rows);
      stage.style.cssText = `width:${SW}px;height:${SH}px;margin:${-SH / 2}px 0 0 ${-SW / 2}px;--r:${num(p.radius, 14)}px;transform:${t3 ? `perspective(1400px) rotateX(${t3}deg) ` : ''}rotate(${-tilt}deg)`;
      stage.textContent = ''; rowsEls.length = 0;
      const asp = ASPECTS[p.format] || ASPECTS.gemischt;
      for (let r = 0; r < rows; r++) {
        // eine "Runde" = alle Bilder einmal, je Reihe anders verschoben und mit eigenen Formaten
        const set = []; let loop = 0;
        const n = Math.max(items.length, 6);
        for (let i = 0; i < n; i++) {
          const it = items[(i + r * 3) % items.length], a = asp[(i * 3 + r * 2) % asp.length], w = Math.round(cardH * a);
          set.push({ it, w }); loop += w + gap;
        }
        const reps = Math.max(2, Math.ceil((SW + loop) / loop) + 1);
        const rowEl = h('div', { class: 'b-reel__row', style: { height: cardH + 'px', top: r * (cardH + gap) + 'px' } });
        for (let k = 0; k < reps; k++) for (const { it, w } of set) {
          const card = h('div', { class: 'b-reel__card', style: { width: w + 'px', marginRight: gap + 'px' }, title: it.title || '' });
          card.append(h('img', { src: it.src, alt: it.title || '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
          if (it.href) { card.classList.add('is-link'); card.addEventListener('click', () => goto(it.href)); }
          rowEl.append(card);
        }
        stage.append(rowEl);
        rowsEls.push({ el: rowEl, loop, dir: r % 2 ? 1 : -1, k: .8 + ((r * 37) % 5) * .1, ph: (r * 0.37 % 1) * loop });
      }
    };

    let tgt = 0, cur = 0, t0 = performance.now(), vis = false, raf = 0, firstDone = false;
    const apply = (x, t) => {
      for (const R of rowsEls) {
        const d = (R.dir * (x * R.k) + R.dir * t * num(p.drift, 0) * R.k + R.ph) % R.loop;
        R.el.style.transform = `translate3d(${-(((d % R.loop) + R.loop) % R.loop) }px,0,0)`;
      }
    };
    const frame = () => {
      raf = 0; if (!vis) return;
      const t = (performance.now() - t0) / 1000;
      cur += (tgt - cur) * (still() ? 1 : .09);
      apply(cur, still() ? 0 : t);
      if (Math.abs(tgt - cur) > .05 || (num(p.drift, 0) && !still())) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && vis) raf = requestAnimationFrame(frame); };
    track(el, (r) => {
      build(); vis = true;
      tgt = -r.top * 1.25 * num(p.speed, 1);
      if (!firstDone) { firstDone = true; cur = tgt; }
      kick();
    });
    // Rhythmus auch ohne Scrollen (Eigentempo) und Größenänderungen
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) { build(); kick(); } }).observe(el);
    new ResizeObserver(() => { built = ''; build(); apply(cur, 0); }).observe(el);
    return el;
  },
};
