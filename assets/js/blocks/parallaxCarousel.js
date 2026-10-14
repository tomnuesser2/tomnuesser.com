import { h } from '../core/dom.js';
import { mobileView } from '../core/media.js';
import { still } from '../core/scrollhub.js';
import { SOURCE, ITEMS, BG, HEIGHT, getItems, mediaNode, playVideosWhenVisible, goto, bgClass, ticker, watchSize, dragHandler, aspectOf, heightOf, clamp, num } from '../core/reelKit.js';

const ORIG = 'Format des jeweiligen Bildes (Hochformat bleibt Hochformat)';
const fixedRatio = (f) => { const m = String(f || '').match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/); return m ? Number(m[1]) / Number(m[2]) : 0; };
// Parallax-Carousel: Reihe aus Bildkarten; beim Verschieben gleiten die Bilder in den Karten gegenläufig (Tiefe).
export default {
  type: 'parallaxCarousel', label: 'Parallax-Carousel (Karten mit gleitenden Bildern)',
  fields: [
    SOURCE, ITEMS, { name: 'format', label: 'Format der Rahmen', type: 'select', options: [ORIG, '16:9', '9:16', '1:1', '4:5', '4:3', '3:2'], default: ORIG }, ...HEIGHT(520, 520), BG,
    { name: 'gap', label: 'Abstand zwischen den Karten in px', type: 'number', default: 32 },
    { name: 'radius', label: 'Rundung in px', type: 'number', default: 16 },
    { name: 'parallax', label: 'Stärke des Parallax-Effekts (0–1)', type: 'number', default: 1 },
    { name: 'uvScale', label: 'Bildausschnitt in der Karte (0.55–1; kleiner = mehr Spielraum)', type: 'number', default: .7 },
    { name: 'lerp', label: 'Weichheit (0.02 = sehr träge, 0.3 = direkt)', type: 'number', default: .08 },
    { name: 'dragSensitivity', label: 'Empfindlichkeit beim Ziehen', type: 'number', default: 1.4 },
    { name: 'wheel', label: 'Mausrad verschiebt (sonst scrollt die Seite)', type: 'checkbox', default: false },
    { name: 'wheelSensitivity', label: 'Empfindlichkeit des Mausrads', type: 'number', default: 1 },
    { name: 'loop', label: 'Endlos', type: 'checkbox', default: true },
    { name: 'autoplaySpeed', label: 'Eigentempo in px pro Sekunde (0 = steht)', type: 'number', default: 40 },
    { name: 'pauseOnHover', label: 'Eigentempo pausiert beim Darüberfahren', type: 'checkbox', default: true },
    { name: 'showProgress', label: 'Fortschrittsbalken unten (nicht bei Endlos)', type: 'checkbox', default: true },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const base = getItems(p, ctx);
    const el = h('div', { class: `pc${bgClass(p.bg)}`, style: { '--pc-rad': num(p.radius, 16) + 'px' } });
    if (base.length < 2) { el.style.height = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    const track = h('div', { class: 'pc__track' }); const bar = h('i', { class: 'pc__bar' }); const prog = h('div', { class: 'pc__prog' }, bar);
    el.append(track); if (p.showProgress !== false && !p.loop) el.append(prog);
    let list = base.slice(), planes = [], W = 0, H = 0, pw = 0, ph = 0, gap = num(p.gap, 32), total = 0, pos = 0, target = 0, hover = false, held = false, off = [], wid = [];
    const fixed = fixedRatio(p.format), asp = new Map(), dflt = () => (mobileView() ? 9 / 16 : 16 / 9);
    const aspOf = (src) => fixed || asp.get(src) || dflt();
    let rb = 0; const later = () => { if (!rb) rb = requestAnimationFrame(() => { rb = 0; build(); }); };
    const learn = (src, w, hh) => { if (fixed || !w || !hh) return; const a = w / hh; if (Math.abs((asp.get(src) || 0) - a) > .01) { asp.set(src, a); if (W) later(); } };
    if (!fixed) base.forEach((it) => { if (/\.(mp4|webm|mov)(\?|$)/i.test(it.src) || /vimeo|youtu/i.test(it.src)) return; const im = new Image(); im.onload = () => learn(it.src, im.naturalWidth, im.naturalHeight); im.src = it.src; });
    const loop = p.loop !== false, uv = clamp(num(p.uvScale, .7), .5, 1), par = clamp(num(p.parallax, 1), 0, 1.2), lerpK = clamp(num(p.lerp, .08), .01, 1);
    const build = () => {
      track.textContent = ''; planes = [];
      // Bei Endlos genug Karten, damit der Bildschirm immer voll ist
      const widthOf = (it) => Math.max(80, Math.min(Math.round(ph * aspOf(it.src)), Math.round(W * .86)));
      list = base.slice(); const sum = (l) => l.reduce((t, it) => t + widthOf(it) + gap, 0);
      if (loop) while (sum(list) < W + (widthOf(base[0]) + gap) * 2.5) list = list.concat(base);
      wid = list.map(widthOf); off = []; total = 0; wid.forEach((w) => { off.push(total); total += w + gap; });
      list.forEach((it, i) => { const m = mediaNode(it.src, 'pc__img', it.title); const pl = h('a', { class: 'pc__plane', href: it.href || null, 'data-link': it.href ? '' : null, draggable: 'false', style: { width: wid[i] + 'px', height: ph + 'px' } }, m); if (!it.href) pl.removeAttribute('href'); if (m.tagName === 'IMG') m.addEventListener('load', () => learn(it.src, m.naturalWidth, m.naturalHeight)); else if (m.tagName === 'VIDEO') m.addEventListener('loadedmetadata', () => learn(it.src, m.videoWidth, m.videoHeight)); track.append(pl); planes.push({ pl, m, w: wid[i], i }); });
      planes.forEach(({ m, w }) => { m.style.width = (w / uv) + 'px'; m.style.height = (ph / uv) + 'px'; m.style.left = -(w / uv - w) / 2 + 'px'; m.style.top = -(ph / uv - ph) / 2 + 'px'; });
      playVideosWhenVisible(el);
    };
    watchSize(el, (w, hh) => {
      W = w; H = hh; ph = Math.round(H * .82); pw = Math.max(80, Math.min(Math.round(ph * aspOf(base[0].src)), Math.round(W * .86))); build();
    });
    const clampPos = () => { if (!loop) { const max = Math.max(0, off[off.length - 1] + (wid[wid.length - 1] - wid[0]) / 2); pos = clamp(pos, -0, max); target = clamp(target, 0, max); } };
    const move = (d) => { target += d; clampPos(); };
    dragHandler(track, { start: () => { held = true; }, move: (dx) => { move(-dx * num(p.dragSensitivity, 1.4)); }, end: (was, v) => { held = false; if (was) move(-v * 220 * num(p.dragSensitivity, 1.4) / 1.4); } });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && p.pauseOnHover !== false) hover = true; }); el.addEventListener('pointerleave', () => { hover = false; });
    if (p.wheel) el.addEventListener('wheel', (e) => { e.preventDefault(); move((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * num(p.wheelSensitivity, 1)); }, { passive: false });
    ticker(el, (dt) => {
      if (!still() && !held && !hover && num(p.autoplaySpeed, 0)) { move(num(p.autoplaySpeed, 0) * dt); }
      pos += (target - pos) * (1 - Math.pow(1 - lerpK, dt * 60)); if (Math.abs(target - pos) < .05) pos = target;
      if (!pw) return; const y = (H - ph) / 2, cx = W / 2;
      for (let i = 0; i < planes.length; i++) {
        const w = wid[i]; let x = off[i] - pos + (loop ? 0 : (W - wid[0]) / 2); if (loop) { x = ((x % total) + total) % total; if (x > total - (w + gap) * 1.3) x -= total; } // um die Mitte herum wickeln
        const { pl, m } = planes[i];
        if (x > W + 40 || x < -w - 40) { pl.style.visibility = 'hidden'; continue; }
        pl.style.visibility = 'visible'; const dn0 = clamp(((x + w / 2) - cx) / (W / 2 + w / 2), -1.2, 1.2); pl.style.transform = `translate3d(${x.toFixed(1)}px,${y}px,0) perspective(900px) rotateY(${(-dn0 * 16).toFixed(1)}deg) scale(${(1 - Math.abs(dn0) * .06).toFixed(3)})`;
        const dn = clamp(((x + w / 2) - cx) / (W / 2 + w / 2), -1.2, 1.2), over = (w / uv - w);
        m.style.transform = `translate3d(${clamp(-dn * par * over * .5, -over / 2, over / 2).toFixed(1)}px,0,0)`;
      }
      if (!loop) bar.style.transform = `scaleX(${clamp(off[off.length - 1] > 0 ? pos / off[off.length - 1] : 1).toFixed(4)})`;
    });
    return el;
  },
};
