import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { SOURCE, ITEMS, FORMAT, BG, HEIGHT, getItems, mediaNode, playVideosWhenVisible, goto, bgClass, ticker, watchSize, aspectOf, clamp, num } from '../core/reelKit.js';

// Elastic Reel: Reihe schmaler Bildstreifen wie das macOS-Dock. Darüberfahren vergrößert sie, Anklicken öffnet das Bild.
export default {
  type: 'elasticReel', label: 'Elastic Reel (Bildstreifen wie ein Dock, Klick öffnet)',
  fields: [
    SOURCE, ITEMS, { ...FORMAT(), label: 'Format des geöffneten Bildes' }, ...HEIGHT(560, 640), BG,
    { name: 'barWidth', label: 'Breite eines Streifens in px', type: 'number', default: 44 },
    { name: 'barHeight', label: 'Höhe der Streifen (Anteil der Blockhöhe, 0.2–0.9)', type: 'number', default: .5 },
    { name: 'gap', label: 'Abstand in px', type: 'number', default: 10 },
    { name: 'radius', label: 'Rundung in px', type: 'number', default: 12 },
    { name: 'magnify', label: 'Vergrößerung in der Breite (1 = aus)', type: 'number', default: 2.4 },
    { name: 'lift', label: 'Vergrößerung in der Höhe', type: 'number', default: 1.15 },
    { name: 'influence', label: 'Reichweite der Vergrößerung in px', type: 'number', default: 200 },
    { name: 'align', label: 'Ausrichtung', type: 'select', options: ['mitte', 'unten'], default: 'mitte' },
    { name: 'openSize', label: 'Größe des geöffneten Bildes (Anteil der Höhe, 0.3–0.95)', type: 'number', default: .72 },
    { name: 'elasticity', label: 'Federn (0 = glatt, 1 = wackelig)', type: 'number', default: .35 },
    { name: 'blur', label: 'Unschärfe der anderen Streifen bei offenem Bild (0–1)', type: 'number', default: .5 },
    { name: 'dim', label: 'Abdunklung der anderen Streifen (0–1)', type: 'number', default: .45 },
    { name: 'shadow', label: 'Schatten (0–1)', type: 'number', default: .35 },
    { name: 'autoplay', label: 'Automatik', type: 'select', options: ['sweep', 'cycle', 'aus'], default: 'sweep' },
    { name: 'speed', label: 'Tempo des „sweep“ in Streifen pro Sekunde', type: 'number', default: 1.4 },
    { name: 'interval', label: 'Sekunden zwischen den Bildern bei „cycle“', type: 'number', default: 4 },
    { name: 'wheel', label: 'Mausrad bewegt die Vergrößerung / blättert (sonst scrollt die Seite)', type: 'checkbox', default: false },
    { name: 'captions', label: 'Titel unter dem geöffneten Bild', type: 'checkbox', default: true },
    { name: 'labels', label: 'Titel des Streifens unter dem Mauszeiger', type: 'checkbox', default: true },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const items = getItems(p, ctx);
    const el = h('div', { class: `er${bgClass(p.bg)}`, style: { '--er-rad': num(p.radius, 12) + 'px', '--er-sh': String(num(p.shadow, .35)) } });
    if (items.length < 2) { el.style.height = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    const n = items.length, openAsp = aspectOf(p.format, 16 / 9, 9 / 16);
    const row = h('div', { class: 'er__row' });
    const bars = items.map((it, i) => { const b = h('button', { class: 'er__bar', type: 'button', 'aria-label': it.title || `Bild ${i + 1}`, 'data-i': i }, mediaNode(it.src, 'er__img', it.title)); row.append(b); return b; });
    const lab = p.labels !== false ? h('div', { class: 'er__lab' }) : null;
    const openImg = h('div', { class: 'er__openimg' });
    const capT = h('b'), capS = h('span'), cap = p.captions !== false ? h('div', { class: 'er__cap' }, capT, capS) : null;
    const open = h('div', { class: 'er__open', hidden: '' }, openImg, cap);
    el.append(row); if (lab) el.append(lab); el.append(open); playVideosWhenVisible(el);

    let W = 0, H = 0, bw = 0, bh = 0, fx = -999, fxT = -999, hov = false, openI = -1, auto = 0, cyc = 0, touch = false, openAnim = 0;
    const gap = num(p.gap, 10), mag = Math.max(1, num(p.magnify, 2.4)), lift = Math.max(1, num(p.lift, 1.15)), infl = Math.max(40, num(p.influence, 200)), el_ = clamp(num(p.elasticity, .35));
    const S = bars.map(() => ({ s: 0, v: 0 })); // Federzustand je Streifen
    const keepBottom = p.align === 'unten';
    const geo = () => { const nn = n; bw = Math.max(6, Math.min(num(p.barWidth, 44), (W * .94 - gap * (nn - 1)) / (nn + (mag - 1) * 2.2))); bh = H * clamp(num(p.barHeight, .5), .2, .9); };
    const capH = () => (p.captions !== false ? 70 : 20) + (p.labels !== false ? 24 : 0);
    watchSize(el, (w, hh) => { W = w; H = hh; geo(); });
    const sm = (k) => k * k * (3 - 2 * k);
    const centers = [];
    const place = (dt) => {
      if (!bw) return;
      const stiff = 220, damp = 2 * Math.sqrt(stiff) * (1 - el_ * .72);
      const widths = [], heights = [];
      // Zielwerte aus dem Abstand zum Fokus
      let tot = 0; centers.length = 0;
      let x = 0; for (let i = 0; i < n; i++) { const c = x + bw / 2; x += bw + gap; centers.push(c); }
      const total0 = x - gap, off0 = (W - total0) / 2;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(off0 + centers[i] - fx), k = openI >= 0 ? 0 : (fx < -500 ? 0 : clamp(1 - d / infl));
        const st = S[i], tgt = sm(k);
        st.v += ((tgt - st.s) * stiff - st.v * damp) * dt; st.s += st.v * dt;
        const s = Math.max(-.2, st.s); widths.push(bw * (1 + (mag - 1) * s)); heights.push(bh * (1 + (lift - 1) * s));
      }
      tot = widths.reduce((a, b) => a + b, 0) + gap * (n - 1);
      let px = (W - tot) / 2; const base = keepBottom ? H - capH() - 18 : (H - capH()) / 2;
      const dimB = openI >= 0 ? clamp(num(p.dim, .45)) : 0, blurB = openI >= 0 ? num(p.blur, .5) * 7 : 0;
      for (let i = 0; i < n; i++) {
        const b = bars[i], w = widths[i], hh = heights[i];
        b.style.width = w.toFixed(1) + 'px'; b.style.height = hh.toFixed(1) + 'px';
        b.style.transform = `translate3d(${px.toFixed(1)}px,${(keepBottom ? base - hh : base - hh / 2).toFixed(1)}px,0)`;
        b.style.zIndex = String(10 + Math.round(S[i].s * 10));
        const hot = i === hovered, bl = hot ? 0 : blurB, op = 1 - (hot ? 0 : dimB);
        b.style.filter = bl > .2 ? `blur(${bl.toFixed(1)}px)` : ''; b.style.opacity = op.toFixed(2);
        px += w + gap;
      }
      if (lab) { const i = hovered >= 0 ? hovered : (openI >= 0 ? -1 : focusIdx()); lab.textContent = i >= 0 && openI < 0 ? (items[i].title || '') : ''; lab.style.top = (keepBottom ? H - capH() + 2 : (H - capH()) / 2 + bh * lift / 2 + 14) + 'px'; }
    };
    let hovered = -1;
    const focusIdx = () => { if (fx < -500) return -1; let best = -1, bd = 1e9; const off = (W - (n * bw + gap * (n - 1))) / 2; for (let i = 0; i < n; i++) { const d = Math.abs(off + i * (bw + gap) + bw / 2 - fx); if (d < bd) { bd = d; best = i; } } return bd < infl ? best : -1; };
    // Öffnen / Schließen: Bild fährt aus dem Streifen groß in die Mitte (und zurück)
    const target = () => { const ah = H - capH(); let hh = ah * clamp(num(p.openSize, .72), .3, .95), ww = hh * openAsp; if (ww > W * .94) { ww = W * .94; hh = ww / openAsp; } return { w: ww, h: hh, x: (W - ww) / 2, y: (ah - hh) / 2 + 6 }; };
    const rectOf = (i) => { const b = bars[i]; const r = b.getBoundingClientRect(), er = el.getBoundingClientRect(); return { x: r.left - er.left, y: r.top - er.top, w: r.width, h: r.height }; };
    const setRect = (r, t) => { openImg.style.transition = t || 'none'; openImg.style.width = r.w + 'px'; openImg.style.height = r.h + 'px'; openImg.style.transform = `translate3d(${r.x}px,${r.y}px,0)`; };
    const ez = `${(.45 + el_ * .2).toFixed(2)}s cubic-bezier(.3,${(1 + el_ * .35).toFixed(2)},.4,1)`;
    const openAt = (i) => {
      if (i < 0 || i >= n) return;
      const was = openI; openI = i; hov = false;
      openImg.replaceChildren(mediaNode(items[i].src, 'er__img', items[i].title)); playVideosWhenVisible(openImg);
      if (cap) { capT.textContent = items[i].title || ''; capS.textContent = items[i].subtitle || ''; }
      open.hidden = false; el.classList.add('is-open');
      if (was < 0) { setRect(rectOf(i)); void openImg.offsetWidth; openImg.style.opacity = '1'; setRect(target(), `transform ${ez}, width ${ez}, height ${ez}`); }
      else { openImg.style.transition = 'none'; openImg.style.opacity = '0'; setRect(target()); requestAnimationFrame(() => { openImg.style.transition = 'opacity .35s'; openImg.style.opacity = '1'; }); }
      cap?.classList.remove('is-in'); void open.offsetWidth; cap?.classList.add('is-in');
    };
    const closeIt = () => {
      if (openI < 0) return; const i = openI; openI = -1; el.classList.remove('is-open');
      setRect(rectOf(i), `transform ${ez}, width ${ez}, height ${ez}`); setTimeout(() => { if (openI < 0) { open.hidden = true; openImg.replaceChildren(); } }, 520);
    };
    const step = (d) => { if (openI >= 0) openAt((openI + d + n) % n); else { fxT = clamp(fxT < -500 ? W / 2 : fxT + d * (bw + gap), 0, W); } };
    // Eingaben
    const pos = (e) => { const r = el.getBoundingClientRect(); return e.clientX - r.left; };
    row.addEventListener('pointermove', (e) => { if (openI >= 0) return; hov = true; auto = 0; fxT = fx < -500 ? pos(e) : pos(e); const b = e.target.closest?.('.er__bar'); hovered = b ? Number(b.dataset.i) : -1; });
    row.addEventListener('pointerleave', () => { hov = false; hovered = -1; });
    row.addEventListener('pointerdown', (e) => { touch = e.pointerType !== 'mouse'; if (touch) { hov = true; fxT = pos(e); } });
    el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(() => { hov = false; hovered = -1; }, 700); });
    row.addEventListener('click', (e) => { const b = e.target.closest('.er__bar'); if (b) openAt(Number(b.dataset.i)); });
    open.addEventListener('click', (e) => { if (e.target.closest('.er__openimg') && items[openI]?.href && e.detail > 1) { goto(items[openI].href); return; } closeIt(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeIt(); else if (openI >= 0 && e.key === 'ArrowRight') step(1); else if (openI >= 0 && e.key === 'ArrowLeft') step(-1); });
    // Wischen im geöffneten Bild = nächstes Bild
    let sx = null; open.addEventListener('pointerdown', (e) => { sx = e.clientX; }); open.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) { step(e.clientX < sx ? 1 : -1); e.stopPropagation(); open.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true }); } sx = null; });
    if (p.wheel) el.addEventListener('wheel', (e) => { e.preventDefault(); step(Math.sign(e.deltaY || e.deltaX)); }, { passive: false });
    ticker(el, (dt) => {
      const mode = p.autoplay;
      if (!still() && !hov && openI < 0 && mode === 'sweep') { auto += dt * num(p.speed, 1.4) * (bw + gap); const L = Math.max(10, n * (bw + gap)), ph = auto % (2 * L); const x = ph < L ? ph : 2 * L - ph; fxT = (W - L) / 2 + x; }
      else if (!still() && !hov && mode === 'cycle') { cyc += dt; if (cyc >= Math.max(1.5, num(p.interval, 4))) { cyc = 0; openAt(openI < 0 ? 0 : (openI + 1) % n); } }
      else if (!hov && openI < 0 && fxT > -500 && mode !== 'sweep') fxT = -999;
      fx = fx < -500 || fxT < -500 ? fxT : fx + (fxT - fx) * (1 - Math.pow(.0005, dt));
      place(dt);
    });
    new ResizeObserver(() => { if (openI >= 0) setRect(target()); }).observe(el);
    return el;
  },
};
