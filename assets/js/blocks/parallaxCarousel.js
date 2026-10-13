import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { SOURCE, ITEMS, FORMAT, BG, HEIGHT, getItems, mediaNode, playVideosWhenVisible, goto, bgClass, ticker, watchSize, dragHandler, aspectOf, heightOf, clamp, num } from '../core/reelKit.js';

// Parallax-Carousel: Reihe aus Bildkarten; beim Verschieben gleiten die Bilder in den Karten gegenläufig (Tiefe).
export default {
  type: 'parallaxCarousel', label: 'Parallax-Carousel (Karten mit gleitenden Bildern)',
  fields: [
    SOURCE, ITEMS, FORMAT(), ...HEIGHT(520, 520), BG,
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
    let list = base.slice(), planes = [], W = 0, H = 0, pw = 0, ph = 0, gap = num(p.gap, 32), total = 0, pos = 0, target = 0, hover = false, held = false;
    const loop = p.loop !== false, uv = clamp(num(p.uvScale, .7), .5, 1), par = clamp(num(p.parallax, 1), 0, 1.2), lerpK = clamp(num(p.lerp, .08), .01, 1);
    const build = () => {
      track.textContent = ''; planes = [];
      // Bei Endlos genug Karten, damit der Bildschirm immer voll ist
      list = base.slice(); if (loop) while (list.length * (pw + gap) < W + (pw + gap) * 2.5) list = list.concat(base);
      total = list.length * (pw + gap);
      list.forEach((it, i) => { const m = mediaNode(it.src, 'pc__img', it.title); const pl = h('a', { class: 'pc__plane', href: it.href || null, 'data-link': it.href ? '' : null, draggable: 'false', style: { width: pw + 'px', height: ph + 'px' } }, m); if (!it.href) pl.removeAttribute('href'); track.append(pl); planes.push({ pl, m }); });
      planes.forEach(({ m }) => { m.style.width = (pw / uv) + 'px'; m.style.height = (ph / uv) + 'px'; m.style.left = -(pw / uv - pw) / 2 + 'px'; m.style.top = -(ph / uv - ph) / 2 + 'px'; });
      playVideosWhenVisible(el);
    };
    watchSize(el, (w, hh) => {
      W = w; H = hh; ph = Math.round(H * .82); pw = Math.round(ph * aspectOf(p.format, 16 / 9, 9 / 16)); if (pw > W * .86) { pw = Math.round(W * .86); ph = Math.round(pw / aspectOf(p.format, 16 / 9, 9 / 16)); }
      pw = Math.max(80, pw); build();
    });
    const clampPos = () => { if (!loop) { const max = Math.max(0, total - gap - pw); pos = clamp(pos, -0, max); target = clamp(target, 0, max); } };
    const move = (d) => { target += d; clampPos(); };
    dragHandler(track, { start: () => { held = true; }, move: (dx) => { move(-dx * num(p.dragSensitivity, 1.4)); }, end: (was, v) => { held = false; if (was) move(-v * 220 * num(p.dragSensitivity, 1.4) / 1.4); } });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && p.pauseOnHover !== false) hover = true; }); el.addEventListener('pointerleave', () => { hover = false; });
    if (p.wheel) el.addEventListener('wheel', (e) => { e.preventDefault(); move((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * num(p.wheelSensitivity, 1)); }, { passive: false });
    ticker(el, (dt) => {
      if (!still() && !held && !hover && num(p.autoplaySpeed, 0)) { move(num(p.autoplaySpeed, 0) * dt); }
      pos += (target - pos) * (1 - Math.pow(1 - lerpK, dt * 60)); if (Math.abs(target - pos) < .05) pos = target;
      if (!pw) return; const step = pw + gap, y = (H - ph) / 2, cx = W / 2;
      for (let i = 0; i < planes.length; i++) {
        let x = i * step - pos + (loop ? 0 : (W - pw) / 2); if (loop) { x = ((x % total) + total) % total; if (x > total - step * 1.3) x -= total; } // um die Mitte herum wickeln
        const { pl, m } = planes[i];
        if (x > W + 40 || x < -pw - 40) { pl.style.visibility = 'hidden'; continue; }
        pl.style.visibility = 'visible'; const dn0 = clamp(((x + pw / 2) - cx) / (W / 2 + pw / 2), -1.2, 1.2); pl.style.transform = `translate3d(${x.toFixed(1)}px,${y}px,0) perspective(900px) rotateY(${(-dn0 * 16).toFixed(1)}deg) scale(${(1 - Math.abs(dn0) * .06).toFixed(3)})`;
        const dn = clamp(((x + pw / 2) - cx) / (W / 2 + pw / 2), -1.2, 1.2), over = (pw / uv - pw);
        m.style.transform = `translate3d(${clamp(-dn * par * over * .5, -over / 2, over / 2).toFixed(1)}px,0,0)`;
      }
      if (!loop) bar.style.transform = `scaleX(${clamp(total - gap - pw > 0 ? pos / (total - gap - pw) : 1).toFixed(4)})`;
    });
    return el;
  },
};
