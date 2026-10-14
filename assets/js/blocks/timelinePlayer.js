import { h } from '../core/dom.js';
import { still, track, trackProgress } from '../core/scrollhub.js';
import { mobileView } from '../core/media.js';
import { isVideo, clamp, num, ticker, goto } from '../core/reelKit.js';

// Color-Page-Player: Schnittprogramm-Look (Farbkorrektur-Arbeitsbereich). Das Bild wird live „gegradet“:
// Räder, Regler, Scopes und Nodes laufen mit, das Video geht von flach (Log) zum fertigen Look.
const NS = 'http://www.w3.org/2000/svg';
const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rnd = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const el_ = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); kids.forEach(c => c && e.append(c)); return e; };
const IC = { play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zM14 5h4v14h-4z', prev: 'M6 5h2v14H6zM20 5v14L9 12z', next: 'M16 5h2v14h-2zM4 5v14l11-7z', loop: 'M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z' };
const icon = (d) => el_('svg', { viewBox: '0 0 24 24' }, el_('path', { d }));
// Looks: Kontrast, Sättigung, Helligkeit, Farbton, Tönung oben/unten, Rad-Ziele (x,y), Regler
const LOOKS = {
  'Teal & Orange': { c: 1.22, s: 1.28, b: .98, hue: -4, sep: 0, a: '#00a6a6', z: '#ff8a3c', ti: .5, lift: [-.35, .25, .4], gamma: [.1, -.05, .3], gain: [.4, -.2, .8], temp: 640, tint: -6.2, sat: 64, shad: 14, hi: -8 },
  'Warm Film': { c: 1.12, s: 1.08, b: 1.02, hue: 6, sep: .22, a: '#ffb05a', z: '#7a3b1d', ti: .45, lift: [.15, -.2, .3], gamma: [.3, .15, .4], gain: [.25, .1, .6], temp: 1180, tint: 3.4, sat: 58, shad: 10, hi: -5 },
  'Cool Night': { c: 1.24, s: .98, b: .93, hue: -10, sep: 0, a: '#2a6bff', z: '#0a1030', ti: .55, lift: [-.3, -.25, .5], gamma: [-.2, -.1, .35], gain: [-.2, .05, .45], temp: -980, tint: -2.1, sat: 56, shad: 18, hi: -12 },
  'Mono Punch': { c: 1.38, s: .02, b: .96, hue: 0, sep: 0, a: '#888888', z: '#222222', ti: .25, lift: [0, 0, .2], gamma: [0, 0, .1], gain: [0, 0, .5], temp: 0, tint: 0, sat: 4, shad: 22, hi: -14 },
};
const LOOK_NAMES = Object.keys(LOOKS);

export default {
  type: 'timelinePlayer', label: 'Color-Page-Player (Schnittprogramm-Look, Video wird live gegradet)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile über dem Fenster (optional)', type: 'text', default: '' },
    { name: 'title', label: 'Überschrift (optional)', type: 'text', default: '' },
    { name: 'text', label: 'Text unter der Überschrift (optional)', type: 'textarea', default: '' },
    { name: 'headAlign', label: 'Text-Versatz', type: 'select', options: ['links', 'mitte', 'rechts'], default: 'mitte' },
    { name: 'hideTexts', label: 'Alle Texte ausblenden (Kopftext, Titel im Bild und Beschriftungen im Fenster)', type: 'checkbox', default: false },
    { name: 'projectName', label: 'Projektname in der Titelleiste', type: 'text', default: 'Showreel – Timeline 1' },
    { name: 'items', label: 'Clips (Bild oder Video; Reihenfolge = Schnittfolge; jeder Clip wird live gegradet)', type: 'list', itemFields: [
      { name: 'image', label: '💻 VORHER: Bild oder Video (Computer)', type: 'image' }, { name: 'imageMobile', label: '📱 VORHER: Bild oder Video (Smartphone, z. B. 9:16; leer = wie Computer)', type: 'image' },
      { name: 'after', label: '💻 NACHHER: gegradetes Bild oder Video (Computer; leer = Grading wird simuliert)', type: 'image' }, { name: 'afterMobile', label: '📱 NACHHER: gegradetes Bild oder Video (Smartphone; leer = wie Computer)', type: 'image' },
      { name: 'title', label: 'Clip-Name', type: 'text' }, { name: 'duration', label: 'Länge in Sekunden', type: 'number', default: 5 },
      { name: 'look', label: 'Look für diesen Clip', type: 'select', options: ['automatisch', ...LOOK_NAMES], default: 'automatisch' },
      { name: 'link', label: 'Link beim Klick auf den Viewer (optional)', type: 'text' }] },
    { name: 'titles', label: 'Titel im Bild (Text, der im Viewer eingeblendet wird)', type: 'list', itemFields: [
      { name: 'text', label: 'Titel-Text', type: 'text' }, { name: 'sub', label: 'Zweite Zeile (optional)', type: 'text' },
      { name: 'start', label: 'Beginnt bei Sekunde', type: 'number', default: 0 }, { name: 'duration', label: 'Länge in Sekunden', type: 'number', default: 3 },
      { name: 'pos', label: 'Position im Bild', type: 'select', options: ['unten links', 'mitte', 'unten mitte'], default: 'unten links' }] },
    { name: 'format', label: 'Format des Viewers', type: 'select', options: ['auto', '16:9', '9:16', '1:1'], default: 'auto' },
    { name: 'mode', label: 'Ablauf', type: 'select', options: ['von allein', 'beim Scrollen'], default: 'von allein' },
    { name: 'scrollLength', label: 'Nur „beim Scrollen“: Scroll-Strecke (Bildschirmhöhen)', type: 'number', default: 2.5 },
    { name: 'speed', label: 'Tempo (1 = Echtzeit)', type: 'number', default: 1 },
    { name: 'loop', label: 'Endlos wiederholen', type: 'checkbox', default: true },
    { name: 'grade', label: 'Color-Grading simulieren, wenn kein Nachher-Bild da ist (Video geht von flach zum Look)', type: 'checkbox', default: true },
    { name: 'wipe', label: 'Mit Wischer (Grading wird aufgezogen; aus = weiche Überblendung)', type: 'checkbox', default: true },
    { name: 'showPool', label: 'Medienpool links zeigen (nur Computer)', type: 'checkbox', default: true },
    { name: 'showNodes', label: 'Node-Graph rechts zeigen (nur Computer)', type: 'checkbox', default: true },
    { name: 'kenBurns', label: 'Leichter Zoom in den Clips', type: 'checkbox', default: true },
    { name: 'accent', label: 'Farbe des Playheads (Hex)', type: 'text', default: '#ff4b3a' },
    { name: 'width', label: 'Maximale Breite am Computer in px', type: 'number', default: 1120 },
    { name: 'fps', label: 'Bilder pro Sekunde (für den Timecode)', type: 'number', default: 25 },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const mob = mobileView(), fps = clamp(Math.round(num(p.fps, 25)), 1, 120);
    const clips = []; let T = 0;
    for (const [n, it] of (p.items || []).entries()) { const src = mob ? (it.imageMobile || it.image) : (it.image || it.imageMobile); if (!src) continue; const d = clamp(num(it.duration, 5), 1.5, 120); const ln = it.look && LOOKS[it.look] ? it.look : LOOK_NAMES[clips.length % LOOK_NAMES.length]; const after = mob ? (it.afterMobile || it.after) : (it.after || it.afterMobile); clips.push({ src, after: after || '', name: it.title || String(src).split('/').pop(), start: T, dur: d, link: it.link || '', look: LOOKS[ln], lookName: ln, n: clips.length + 1 }); T += d; }
    const el = h('section', { class: `tp${p.mode === 'beim Scrollen' ? ' tp--scroll' : ''}${p.hideTexts ? ' tp--notext' : ''}`, id: p.id, style: { '--tp-ac': p.accent || '#ff4b3a', '--tp-w': num(p.width, 1120) + 'px', '--tp-len': Math.max(.5, num(p.scrollLength, 2.5)) } });
    if (clips.length < 1) { el.append(h('p', { class: 'reel-empty' }, 'Mindestens 1 Clip hinzufügen.')); return el; }
    const titles = (p.titles || []).filter(t => t.text).map(t => ({ ...t, start: Math.max(0, num(t.start, 0)), dur: Math.max(.5, num(t.duration, 3)) }));
    const tcOf = (t) => { const f = Math.floor(t * fps), s = Math.floor(f / fps), m = Math.floor(s / 60); return `01:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f % fps).padStart(2, '0')}`; };
    const f2 = (v, d = 2) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(d);

    /* ---- Kopftext ---- */
    const align = p.headAlign === 'links' ? 'left' : p.headAlign === 'rechts' ? 'right' : 'center';
    const head = (p.kicker || p.title || p.text) ? h('div', { class: `tp__head is-${align}` }, p.kicker ? h('p', { class: 'tp__k' }, p.kicker) : null, p.title ? h('h2', { class: 'tp__h' }, p.title) : null, p.text ? h('p', { class: 'tp__p' }, p.text) : null) : null;

    /* ---- Viewer ---- */
    const fmt = p.format === 'auto' ? (mob ? '9:16' : '16:9') : p.format; const [fw, fh] = fmt.split(':').map(Number);
    const vids = new Map(); const doGrade = p.grade !== false, doWipe = p.wipe !== false && doGrade;
    const layers = clips.map((c, i) => {
      const mk = (src) => { if (isVideo(src)) { const v = h('video', { src, muted: true, loop: true, playsinline: true, preload: i < 2 ? 'auto' : 'metadata', 'aria-hidden': 'true' }); v.muted = true; (vids.get(i) || vids.set(i, []).get(i)).push(v); return v; } return h('img', { src, alt: c.name, decoding: 'async', loading: i < 2 ? 'eager' : 'lazy', draggable: 'false' }); };
      const m = mk(c.src); const top = c.after ? mk(c.after) : (!isVideo(c.src) && doWipe ? mk(c.src) : null);
      return h('div', { class: 'tp__layer' }, m, top);
    });
    const tint = h('div', { class: 'tp__tint' }), vig = h('div', { class: 'tp__vig' }), wipeLine = h('i', { class: 'tp__wl' });
    const lblO = h('span', { class: 'tp__lbl tp__lo' }, 'Original'), lblG = h('span', { class: 'tp__lbl tp__lg' }, 'Graded');
    const ttlEl = h('div', { class: 'tp__ttl' }, h('b'), h('span'));
    const tcBig = h('div', { class: 'tp__tc' }, tcOf(0));
    const vp = h('div', { class: 'tp__vp', style: { aspectRatio: `${fw}/${fh}` } }, layers, tint, vig, ttlEl, wipeLine, lblO, lblG);
    const play = h('button', { type: 'button', class: 'tp__b tp__b--play', 'aria-label': 'Abspielen / Pause' }), prevB = h('button', { type: 'button', class: 'tp__b', 'aria-label': 'Vorheriger Clip' }, icon(IC.prev)), nextB = h('button', { type: 'button', class: 'tp__b', 'aria-label': 'Nächster Clip' }, icon(IC.next));
    const loopB = h('button', { type: 'button', class: `tp__b tp__b--loop${p.loop !== false ? ' on' : ''}`, 'aria-label': 'Wiederholen' }, icon(IC.loop));
    const lookName = h('b', {}, '');
    const ctl = h('div', { class: 'tp__ctl' }, h('span', { class: 'tp__tcs tp__lbl' }, 'Look: ', lookName), h('div', { class: 'tp__btns' }, prevB, play, nextB, loopB), h('span', {}));
    const view = h('div', { class: 'tp__view' }, h('div', { class: 'tp__vh' }, h('span', { class: 'tp__lbl' }, 'Timeline 1 ▾'), h('span', { class: 'tp__lbl tp__vz' }, 'Fit ▾'), tcBig), h('div', { class: 'tp__vw' }, vp), ctl);

    /* ---- Medienpool (links) ---- */
    const showPl = p.showPool !== false, showNd = p.showNodes !== false;
    const poolItems = clips.map((c) => { const b = h('button', { type: 'button', class: 'tp__pi', title: c.name }, h('span', { class: 'tp__pt' }, isVideo(c.src) ? h('video', { src: c.src, muted: true, preload: 'metadata', 'aria-hidden': 'true' }) : h('img', { src: c.src, alt: '', loading: 'lazy', draggable: 'false' }), h('em', { class: 'tp__lbl' }, tcOf(c.dur).slice(3))), h('span', { class: 'tp__lbl tp__pn' }, c.name)); b.addEventListener('click', () => seek(c.start + .01)); return b; });
    const scopes = h('aside', { class: 'tp__pool' }, h('div', { class: 'tp__tabs2 tp__lbl' }, ['Gallery', 'LUTs', 'Media Pool'].map((n, i) => h('span', { class: i === 2 ? 'on' : '' }, n))), h('div', { class: 'tp__pg' }, poolItems));

    /* ---- Nodes ---- */
    const nodeBoxes = [];
    const nsvg = el_('svg', { viewBox: '0 0 220 120', class: 'tp__ng', preserveAspectRatio: 'xMidYMid meet' });
    const NP = [[56, 34], [110, 34], [164, 34], [110, 86]];
    nsvg.append(el_('path', { d: 'M22 34H42M70 34H96M124 34H150M178 34H200M110 48V72', class: 'tp__nl2' }), el_('path', { d: 'M14 28l9 6-9 6z', class: 'tp__nin' }), el_('path', { d: 'M200 28l9 6-9 6z', class: 'tp__nout' }));
    NP.slice(0, 3).forEach(([x, y], i) => { const g = el_('g', { class: 'tp__nd' }); g.append(el_('rect', { x: String(x - 14), y: String(y - 14), width: '28', height: '28', rx: '3' }), el_('text', { x: String(x), y: String(y + 4), 'text-anchor': 'middle' }, document.createTextNode(String(i + 1).padStart(2, '0')))); nsvg.append(g); nodeBoxes.push(g); });
    const nodes = h('aside', { class: 'tp__nodes' }, h('div', { class: 'tp__tabs2 tp__lbl' }, ['Nodes', 'Clips'].map((n, i) => h('span', { class: i === 0 ? 'on' : '' }, n))), nsvg, h('div', { class: 'tp__nnames tp__lbl' }, ['Balance', 'Look', 'Vignette'].map(n => h('span', {}, n))));
    const top = h('div', { class: `tp__top${showPl ? ' has-pl' : ''}${showNd ? ' has-nd' : ''}` }, showPl ? scopes : null, view, showNd ? nodes : null);

    /* ---- Clipleiste (Timeline-Streifen) ---- */
    const PPS = mob ? 56 : 74, W = Math.ceil(T * PPS) + 90;
    const ruler = h('div', { class: 'tp__ruler' });
    for (let s = 0; s <= Math.ceil(T) + 1; s++) { const major = s % 2 === 0; ruler.append(h('i', { class: `tp__tick${major ? ' is-maj' : ''}`, style: { left: s * PPS + 'px' } }, major ? h('span', {}, tcOf(s).slice(3)) : null)); }
    const strip = clips.map((c, i) => h('div', { class: 'tp__clip tp__clip--v', style: { left: c.start * PPS + 'px', width: Math.max(8, c.dur * PPS - 3) + 'px' } },
      h('div', { class: 'tp__cl' }, h('b', {}, String(c.n).padStart(2, '0')), h('em', {}, c.name), h('i', { class: 'tp__fx' })), h('div', { class: 'tp__th', style: { backgroundImage: isVideo(c.src) ? 'none' : `url("${c.src}")` } }, isVideo(c.src) ? h('video', { src: c.src, muted: true, preload: 'metadata', 'aria-hidden': 'true' }) : null)));
    const ph = h('div', { class: 'tp__ph2' }, h('i', {}));
    const content = h('div', { class: 'tp__content', style: { width: W + 'px' } }, ruler, h('div', { class: 'tp__lanes' }, h('div', { class: 'tp__tr' }, strip)), ph);
    const scroll = h('div', { class: 'tp__scroll' }, content);
    const tl = h('div', { class: 'tp__tl' }, h('div', { class: 'tp__hd' }, h('div', { class: 'tp__hr' }), h('div', { class: 'tp__hn' }, h('b', {}, 'V1'), h('span', { class: 'tp__lk' }))), scroll);

    /* ---- Farbrad-Panel ---- */
    const wheelData = ['Lift', 'Gamma', 'Gain', 'Offset'].map((n) => { const dot = h('u', {}); const val = h('div', { class: 'tp__wv2' }, ['0.00', '0.00', '0.00', '0.00'].map(v => h('b', {}, v))); const knob = h('span', {}); return { n, dot, knob, val, ui: h('div', { class: 'tp__w' }, h('div', { class: 'tp__wt' }, h('span', { class: 'tp__lbl' }, n), h('i', { class: 'tp__rs' })), h('i', { class: 'tp__ring' }, dot), h('div', { class: 'tp__mst' }, knob), val) }; });
    const nbox = (list) => list.map(([label, k]) => { const b = h('b', {}, ''); return { k, b, ui: h('div', { class: 'tp__nb' }, h('span', { class: 'tp__lbl' }, label), b) }; });
    const rowA = nbox([['Temp', 'temp'], ['Tint', 'tint'], ['Contrast', 'c'], ['Pivot', 'piv'], ['Mid/Detail', 'md']]), rowB = nbox([['Color Boost', 'cb'], ['Shad', 'shad'], ['Hi', 'hi'], ['Sat', 'sat'], ['Hue', 'hue'], ['L. Mix', 'lmix']]);
    const slEls = [...rowA, ...rowB];
    const cw = h('div', { class: 'tp__cw' }, h('div', { class: 'tp__cwh' }, h('b', { class: 'tp__lbl' }, 'Primaries - Color Wheels'), h('span', { class: 'tp__cwi' }, h('i', {}), h('i', {}), h('i', {}))), h('div', { class: 'tp__cwb' }, h('div', { class: 'tp__nrow' }, rowA.map(x => x.ui)), h('div', { class: 'tp__wheels' }, wheelData.map(w => w.ui)), h('div', { class: 'tp__nrow tp__nrow--b' }, rowB.map(x => x.ui))));
    const PAGES = [['Media', 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z'], ['Cut', 'M5 6l14 12M19 6L5 18'], ['Edit', 'M4 7h10M8 12h12M4 17h8'], ['Fusion', 'M5 12a3 3 0 106 0 3 3 0 10-6 0M11 12h6M17 7v10'], ['Color', 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 9a3 3 0 100 6 3 3 0 000-6z'], ['Fairlight', 'M6 8v8M10 5v14M14 9v6M18 7v10'], ['Deliver', 'M5 19L19 5M9 5h10v10']];
    const pages = h('nav', { class: 'tp__pages', 'aria-hidden': 'true' }, PAGES.map(([n, d]) => h('span', { class: `tp__pgb${n === 'Color' ? ' on' : ''}` }, (() => { const sv = el_('svg', { viewBox: '0 0 24 24' }); sv.append(el_('path', { d })); return sv; })(), h('span', { class: 'tp__lbl' }, n))));
    const win = h('div', { class: `tp__win tp__win--color${fh > fw ? ' tp--tall' : ''}` }, h('div', { class: 'tp__bar' }, h('span', { class: 'tp__dots' }, h('i', {}), h('i', {}), h('i', {})), h('b', { class: 'tp__lbl' }, p.projectName || ''), h('span', { class: 'tp__st tp__lbl' }, 'Bearbeitet')), top, tl, cw, pages);
    const stage = h('div', { class: 'tp__stage' }, head, win);
    let trkEl = null, stk = null;
    if (p.mode === 'beim Scrollen') { stk = h('div', { class: 'tp__sticky' }, stage); trkEl = h('div', { class: 'tp__track' }, stk); el.append(trkEl); } else el.append(stage);

    /* ---- Wiedergabe ---- */
    const scrollMode = p.mode === 'beim Scrollen';
    let t = 0, playing = !scrollMode && !still(), cur = -1, resume = 0, pan = 0, drag = false, hold = 0, tProg = 0, lastTc = '', vw = 0;
    const setPlay = (on) => { playing = on; play.replaceChildren(icon(on ? IC.pause : IC.play)); play.classList.toggle('on', on); };
    setPlay(playing);
    const idxAt = (x) => { let k = 0; for (let i = 0; i < clips.length; i++) if (clips[i].start <= x + 1e-6) k = i; return k; };
    const seek = (x) => { t = clamp(x, 0, T - .001); hold = 0; };
    play.addEventListener('click', () => { if (scrollMode) return; if (!playing && t >= T - .05) t = 0; setPlay(!playing); resume = 0; });
    prevB.addEventListener('click', () => { const i = idxAt(t); seek(t - clips[i].start > 1 ? clips[i].start : clips[Math.max(0, i - 1)].start); });
    nextB.addEventListener('click', () => { const i = idxAt(t); seek(clips[(i + 1) % clips.length].start); });
    loopB.addEventListener('click', () => { p.loop = p.loop === false; loopB.classList.toggle('on', p.loop !== false); });
    vp.addEventListener('click', () => { const c = clips[idxAt(t)]; if (c && c.link) goto(c.link); });
    const xToT = (e) => { const r = scroll.getBoundingClientRect(); return clamp((e.clientX - r.left + pan) / PPS, 0, T - .001); };
    // Maus: sofort greifen. Finger: erst nach klar waagerechter Bewegung, damit die Seite beim Scrollen über der Zeitleiste normal weiterläuft
    let pend = null; const grab = (e) => { drag = true; try { scroll.setPointerCapture?.(e.pointerId); } catch { /* egal */ } t = xToT(e); hold = 0; };
    scroll.addEventListener('pointerdown', (e) => { if (scrollMode) return; if (e.pointerType === 'mouse') { grab(e); return; } pend = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    scroll.addEventListener('pointermove', (e) => {
      if (drag) { t = xToT(e); return; }
      if (!pend || e.pointerId !== pend.id) return;
      const dx = Math.abs(e.clientX - pend.x), dy = Math.abs(e.clientY - pend.y);
      if (dy > 8 && dy > dx * .7) { pend = null; return; }
      if (dx > 10 && dx > dy * 1.4) { pend = null; grab(e); }
    });
    const up = () => { pend = null; if (drag) { drag = false; resume = 1.4; } };
    scroll.addEventListener('pointerup', up); scroll.addEventListener('pointercancel', up);
    if (scrollMode && !still()) track(trkEl, (r) => { tProg = trackProgress(r, stk.offsetHeight); });
    const mix = (a, b, g) => a + (b - a) * g;
    const FLAT = { c: .72, s: .32, b: 1.1 };

    ticker(el, (dt) => {
      if (scrollMode && !still()) { const target = tProg * (T - .001); t += (target - t) * Math.min(1, dt * 9); }
      else if (playing && !drag) {
        if (hold > 0) { hold -= dt; if (hold <= 0) t = 0; }
        else { t += dt * num(p.speed, 1); if (t >= T) { if (p.loop !== false) { t = T - .001; hold = 1.1; } else { t = T - .001; setPlay(false); } } }
      } else if (!playing && resume > 0 && !drag && !scrollMode) { resume -= dt; if (resume <= 0) setPlay(true); }
      const i = idxAt(t), c = clips[i], local = t - c.start, L = c.look;
      if (i !== cur) {
        cur = i; layers.forEach((l, k) => l.classList.toggle('on', k === i)); strip.forEach((e, k) => e.classList.toggle('is-sel', k === i)); poolItems.forEach((e, k) => e.classList.toggle('on', k === i));
        vids.forEach((arr, k) => arr.forEach(v => { if (k === i) { try { v.currentTime = local % (v.duration || 1e9); } catch (e) { } v.play().catch(() => { }); } else v.pause(); }));
        lookName.textContent = c.lookName;
      }
      // Grading: in den ersten ~65 % des Clips von „flach“ zum Look
      const gRaw = doGrade || c.after ? clamp((local - c.dur * .08) / (c.dur * .58)) : 1, g = ease(gRaw);
      const kids = [...layers[i].children], z = p.kenBurns !== false ? 1 + .06 * (local / c.dur) : 1, hasTop = kids.length > 1;
      kids.forEach(m => { m.style.transform = `scale(${z.toFixed(4)})`; });
      const full = `contrast(${L.c}) saturate(${L.s}) brightness(${L.b}) hue-rotate(${L.hue}deg) sepia(${L.sep})`;
      const flat = `contrast(${FLAT.c}) saturate(${FLAT.s}) brightness(${FLAT.b})`;
      tint.style.background = `linear-gradient(180deg, ${L.a}, ${L.z})`;
      if (hasTop && c.after) { // echtes Vorher/Nachher: eigenes gegradetes Bild
        kids[0].style.filter = 'none'; kids[1].style.filter = 'none'; tint.style.opacity = '0'; vig.style.opacity = '0';
        if (p.wipe === false) { kids[1].style.clipPath = 'none'; kids[1].style.opacity = g.toFixed(3); wipeLine.style.opacity = '0'; }
        else { kids[1].style.opacity = '1'; kids[1].style.clipPath = `inset(0 ${((1 - g) * 100).toFixed(2)}% 0 0)`; wipeLine.style.left = (g * 100).toFixed(2) + '%'; wipeLine.style.opacity = g > .003 && g < .997 ? '1' : '0'; }
        lblO.style.opacity = g < .9 ? '1' : '0'; lblG.style.opacity = g > .22 ? '1' : '0';
      } else if (hasTop) { // Wischer: links Grading, rechts Original
        const clipP = `inset(0 ${((1 - g) * 100).toFixed(2)}% 0 0)`; kids[0].style.filter = flat; kids[1].style.filter = full; kids[1].style.clipPath = clipP;
        tint.style.clipPath = clipP; vig.style.clipPath = clipP; tint.style.opacity = String(L.ti); vig.style.opacity = '.8';
        wipeLine.style.left = (g * 100).toFixed(2) + '%'; wipeLine.style.opacity = g > .003 && g < .997 ? '1' : '0';
        lblO.style.opacity = g < .9 ? '1' : '0'; lblG.style.opacity = g > .22 ? '1' : '0';
      } else {
        const cc = mix(FLAT.c, L.c, g), ss = mix(FLAT.s, L.s, g), bb = mix(FLAT.b, L.b, g);
        kids[0].style.filter = `contrast(${cc.toFixed(3)}) saturate(${ss.toFixed(3)}) brightness(${bb.toFixed(3)}) hue-rotate(${(L.hue * g).toFixed(1)}deg) sepia(${(L.sep * g).toFixed(3)})`;
        tint.style.clipPath = 'none'; vig.style.clipPath = 'none'; tint.style.opacity = (g * L.ti).toFixed(3); vig.style.opacity = (g * .8).toFixed(3);
        wipeLine.style.opacity = '0'; lblO.style.opacity = '0'; lblG.style.opacity = g > .5 ? '1' : '0';
      }
      // Räder + Zahlen
      const tg = [L.lift, L.gamma, L.gain, [0, 0, 0]];
      wheelData.forEach((w, k) => { const [x, y, m] = tg[k]; w.dot.style.transform = `translate(${(x * g * 15).toFixed(1)}px, ${(-y * g * 15).toFixed(1)}px)`; const r = x * g * .06, gg = y * g * .06, b2 = -x * g * .05; w.val.children[0].textContent = f2((m || 0) * g * .12); w.val.children[1].textContent = f2(r); w.val.children[2].textContent = f2(gg); w.val.children[3].textContent = f2(b2); });
      const vals = { temp: mix(0, L.temp, g), tint: mix(0, L.tint, g), c: mix(1, L.c, g), piv: .435, md: -g * 3.5, cb: g * 18, shad: mix(0, L.shad, g), hi: mix(0, L.hi, g), sat: mix(50, L.sat, g), hue: 50, lmix: 100 };
      slEls.forEach((s2) => { const v = vals[s2.k]; s2.b.textContent = s2.k === 'temp' ? v.toFixed(0) : s2.k === 'c' || s2.k === 'piv' ? v.toFixed(3) : v.toFixed(2); });
      wheelData.forEach((w, k) => { const m = [L.lift, L.gamma, L.gain, [0, 0, 0]][k][2] || 0; w.knob.style.left = (50 + (k === 2 ? g * 18 : k === 0 ? -g * 14 : 0) * 1 + (k === 1 ? g * 6 : 0)).toFixed(1) + '%'; });
      nodeBoxes.forEach((n, k) => n.classList.toggle('on', g > [.1, .45, .8][k]));
      // Titel
      const tt = titles.find(x => t >= x.start && t < x.start + x.dur);
      if (tt) { const k = String(titles.indexOf(tt)); if (ttlEl.dataset.k !== k) { ttlEl.dataset.k = k; ttlEl.firstChild.textContent = tt.text; ttlEl.lastChild.textContent = tt.sub || ''; ttlEl.className = `tp__ttl is-${(tt.pos || 'unten links').replace(' ', '-')}`; } const f = t - tt.start; ttlEl.style.opacity = String(clamp(Math.min(f / .35, (tt.dur - f) / .35))); ttlEl.style.transform = `translateY(${((1 - clamp(f / .5)) * 14).toFixed(1)}px)`; }
      else { ttlEl.dataset.k = ''; ttlEl.style.opacity = '0'; }
      // Playhead + Streifen schwenkt mit
      const x = t * PPS; vw = scroll.clientWidth || vw;
      const tgt = clamp(x - vw * .4, 0, Math.max(0, W - vw)); pan += (tgt - pan) * Math.min(1, dt * (hold > 0 || t < .05 ? 4 : 7));
      content.style.transform = `translate3d(${(-pan).toFixed(1)}px,0,0)`; ph.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      const tc = tcOf(t); if (tc !== lastTc) { lastTc = tc; tcBig.textContent = tc; }
    });
    return el;
  },
};
