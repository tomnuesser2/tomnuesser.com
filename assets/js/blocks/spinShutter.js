import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { SOURCE, ITEMS, FORMAT, BG, HEIGHT, getItems, mediaNode, playVideosWhenVisible, goto, bgClass, ticker, watchSize, dragHandler, aspectOf, clamp, num } from '../core/reelKit.js';

// Spin Shutter: Ring aus Fotos, der sich aus einem Stapel öffnet; vorne scharf, hinten weich und blass.
const TAU = Math.PI * 2;
const wrapA = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const ease = (t) => 1 - Math.pow(1 - t, 3);

export default {
  type: 'spinShutter', label: 'Spin Shutter (kreisender Foto-Ring mit Tiefenunschärfe)',
  fields: [
    SOURCE, ITEMS, FORMAT(), ...HEIGHT(640, 640), BG,
    { name: 'count', label: 'Anzahl Karten (Bilder wiederholen sich; 0 = jedes Bild einmal)', type: 'number', default: 0 },
    { name: 'size', label: 'Kartengröße (0.15–0.7, relativ zum Ring)', type: 'number', default: .3 },
    { name: 'radius', label: 'Rundung in px', type: 'number', default: 14 },
    { name: 'tilt', label: 'Kamerahöhe in Grad (0 = flache Reihe, höher = offener Ring)', type: 'number', default: 20 },
    { name: 'roll', label: 'Drehung des ganzen Rings in Grad (diagonal)', type: 'number', default: -24 },
    { name: 'distance', label: 'Kameraabstand (kleiner = mehr Perspektive, 1.8–6)', type: 'number', default: 3.2 },
    { name: 'scale', label: 'Größe des Ganzen (0.5–1.6)', type: 'number', default: 1 },
    { name: 'cluster', label: 'Karten pro Gruppe (1 = gleichmäßig)', type: 'number', default: 1 },
    { name: 'spread', label: 'Abstand in der Gruppe (0.05 = gestapelt, 1 = gleichmäßig)', type: 'number', default: .6 },
    { name: 'speed', label: 'Tempo in Umdrehungen pro Minute (negativ = andersherum, 0 = steht)', type: 'number', default: 1.2 },
    { name: 'aperture', label: 'Tiefenunschärfe (0 = alles scharf)', type: 'number', default: .45 },
    { name: 'haze', label: 'Verblassen der hinteren Karten (0–1)', type: 'number', default: .3 },
    { name: 'shadow', label: 'Schatten (0–1)', type: 'number', default: .35 },
    { name: 'intro', label: 'Aus einem Stapel aufdrehen beim Erscheinen', type: 'checkbox', default: true },
    { name: 'pauseOnHover', label: 'Beim Darüberfahren sanft anhalten', type: 'checkbox', default: true },
    { name: 'draggable', label: 'Ziehen dreht den Ring', type: 'checkbox', default: true },
    { name: 'wheel', label: 'Mausrad dreht eine Karte weiter (sonst scrollt die Seite)', type: 'checkbox', default: false },
    { name: 'captions', label: 'Titel der vorderen Karte anzeigen', type: 'checkbox', default: true },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const base = getItems(p, ctx);
    const el = h('div', { class: `ss${bgClass(p.bg)}`, style: { '--ss-rad': num(p.radius, 14) + 'px' } });
    if (base.length < 2) { el.style.height = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    const N = Math.max(base.length, Math.min(48, Math.round(num(p.count, 0)) || base.length));
    const list = Array.from({ length: N }, (_, i) => base[i % base.length]);
    const ring = h('div', { class: 'ss__ring' }), cards = list.map((it, i) => { const c = h('div', { class: 'ss__card', 'data-i': i }, mediaNode(it.src, 'ss__img', it.title)); ring.append(c); return c; });
    const capT = h('b'), capS = h('span'), cap = p.captions !== false ? h('div', { class: 'ss__cap' }, capT, capS) : null;
    el.append(ring); if (cap) el.append(cap); playVideosWhenVisible(el);
    const asp = aspectOf(p.format, 16 / 9, 9 / 16);
    let W = 0, H = 0, R = 0, ch = 0, cw = 0;
    let rot = 0, vel = 0, hold = false, hover = false, introT = p.intro !== false && !still() ? 0 : 1, tiltExtra = 0, tiltV = 0, goal = null, front = -1, speedK = 1, wheelGoal = null;
    const step = TAU / N, cl = Math.max(1, Math.round(num(p.cluster, 1))), spr = clamp(num(p.spread, .6), .05, 1);
    const baseAngle = (i) => { if (cl <= 1) return i * step; const g = Math.floor(i / cl), j = i % cl; return (g * cl + (cl - 1) / 2) * step + (j - (cl - 1) / 2) * step * spr; };
    watchSize(el, (w, hh) => {
      W = w; H = hh - (p.captions !== false ? 56 : 0); const sc = num(p.scale, 1);
      R = Math.min(W * (asp < 1 ? .5 : .46), H * .54) * sc; ch = R * num(p.size, .3) * (asp < 1 ? 1.35 : 1.15); cw = ch * asp; if (cw > R * .9) { cw = R * .9; ch = cw / asp; }
      cards.forEach(c => { c.style.width = cw + 'px'; c.style.height = ch + 'px'; });
      ring.style.height = H + 'px';
    });
    const D = Math.max(1.6, num(p.distance, 3.2)), roll = num(p.roll, -24) * Math.PI / 180, ap = num(p.aperture, .45), hz = clamp(num(p.haze, .3)), sh = clamp(num(p.shadow, .35));
    const frontIdx = () => { let b = 0, bd = 9; for (let i = 0; i < N; i++) { const d = Math.abs(wrapA(baseAngle(i) + rot)); if (d < bd) { bd = d; b = i; } } return b; };
    const toFront = (i) => { goal = wrapA(-baseAngle(i)); wheelGoal = null; };
    const draw = (dt) => {
      if (!cw) return;
      // Drehung
      const spd = still() ? 0 : num(p.speed, 1.2) * TAU / 60;
      const slow = (hover && p.pauseOnHover !== false) || hold || goal != null || wheelGoal != null ? 0 : 1; speedK += (slow - speedK) * Math.min(1, dt * 3);
      if (introT < 1) introT = Math.min(1, introT + dt / 1.9);
      const ie = ease(introT);
      if (goal != null) { const d = wrapA(goal - rot); rot += d * Math.min(1, dt * 6); if (Math.abs(d) < .002) { rot = goal; goal = null; } }
      else if (!hold) { rot += (vel + spd * speedK) * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) < .0005) vel = 0; }
      // Kippen nach Ziehen quer zur Ringrichtung, federt zurück
      if (!hold) { tiltV += (-60 * tiltExtra - 11 * tiltV) * dt; tiltExtra += tiltV * dt; }
      const tl = (num(p.tilt, 14) + tiltExtra) * Math.PI / 180, ct = Math.cos(tl), st = Math.sin(tl);
      const cx = W / 2, cy = H / 2 - 6, Dd = D * R;
      for (let i = 0; i < N; i++) {
        const a = (baseAngle(i) + rot) * ie + (1 - ie) * 0, ang = a;
        let x = R * Math.sin(ang), z = R * Math.cos(ang);
        // Stapel beim Aufdrehen: alles zieht sich zur Mitte zusammen
        const pull = ie; x *= pull; z = z * pull + (1 - pull) * R;
        const y = z * st, zz = z * ct, s = Dd / (Dd - zz);
        let sx = x * s, sy = y * s;
        const rx = sx * Math.cos(roll) - sy * Math.sin(roll), ry = sx * Math.sin(roll) + sy * Math.cos(roll);
        const dn = clamp((z / R + 1) / 2), c = cards[i];
        const bl = ap * (1 - dn) * 9, op = (1 - hz * (1 - dn)) * clamp(introT * 3);
        c.style.transform = `translate3d(${(cx + rx - cw / 2).toFixed(1)}px,${(cy + ry - ch / 2).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
        c.style.zIndex = String(Math.round(zz + R * 2));
        c.style.filter = bl > .25 ? `blur(${bl.toFixed(1)}px)` : '';
        c.style.opacity = op.toFixed(3);
        c.style.boxShadow = sh ? `0 ${(18 * dn * s).toFixed(0)}px ${(46 * s).toFixed(0)}px rgba(0,0,0,${(sh * (.35 + dn * .65)).toFixed(2)})` : 'none';
      }
      const f = frontIdx();
      if (f !== front) { front = f; if (cap) { capT.textContent = list[f].title || ''; capS.textContent = list[f].subtitle || ''; cap.classList.remove('is-in'); void cap.offsetWidth; cap.classList.add('is-in'); } }
    };
    ticker(el, (dt) => draw(dt));
    // Eingaben
    let ax = 0;
    if (p.draggable !== false) dragHandler(ring, { start: () => { hold = true; goal = null; vel = 0; }, move: (dx, e, v) => { const k = TAU / (R * 2.4); rot += dx * k; vel = v * 1000 * k; }, end: () => { hold = false; } });
    ring.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; }); ring.addEventListener('pointerleave', () => { hover = false; });
    ring.addEventListener('click', (e) => { const c = e.target.closest('.ss__card'); if (!c) return; const i = Number(c.dataset.i), f = frontIdx(); if (i === f) { if (list[i].href) goto(list[i].href); } else toFront(i); });
    if (p.wheel) ring.addEventListener('wheel', (e) => { e.preventDefault(); const f = frontIdx(); toFront((f + (e.deltaY > 0 ? 1 : -1) + N) % N); }, { passive: false });
    el.tabIndex = 0; el.addEventListener('keydown', (e) => { const f = frontIdx(); if (e.key === 'ArrowRight') toFront((f + 1) % N); else if (e.key === 'ArrowLeft') toFront((f - 1 + N) % N); else if (e.key === 'Enter' && list[f].href) goto(list[f].href); });
    return el;
  },
};
