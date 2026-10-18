// 3D-Karussell: Karten auf einem Zylinder, leicht gebogen, überlappend, ziehbar, mit Drift und Einrasten.
// Vanilla-Port der "CircularCarousel"-Idee (nur Preset "cylinder").
// carousel3d(root, items, opts) -> { focus(i), pause(on), destroy() }
//   items: [{ src, href?, title? }]
//   opts.size(rect) -> { w, aspect }   Kartenbreite und Seitenverhältnis (Breite/Höhe) abhängig von der Fläche
//   opts.onChange(index), opts.onFront(item, index) wird beim Tippen auf die vordere Karte gerufen (sonst: Navigation per Link)
import { h } from './dom.js';

const TILES_MAX = 8, OVERLAP = 2.5, DRAG = 5, SPRING = 118, SETTLE = 9, RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const easeQuint = (t) => 1 - Math.pow(1 - t, 5);
const inOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rotX = (p, d) => { const r = d * RAD, c = Math.cos(r), s = Math.sin(r); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const rotY = (p, d) => { const r = d * RAD, c = Math.cos(r), s = Math.sin(r); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };

export function carousel3d(root, items, o = {}) {
  const O = { gap: 36, tilt: 3, curve: .46, perspective: 1040, speed: 14, momentum: .6, parallax: .3, stretch: .5, depthFade: .55, innerShade: .6, radius: 12, intro: true, reduced: false, ...o };
  const count = items.length, step = 360 / count;
  const TILES = O.light ? 5 : TILES_MAX;
  root.classList.add('cc');
  root.style.setProperty('--cc-radius', O.radius + 'px');
  root.style.setProperty('--cc-inner', (1 - clamp(O.innerShade, 0, 1)).toFixed(3));
  const stage = h('div', { class: 'cc__stage' }), camera = h('div', { class: 'cc__camera' }), ring = h('div', { class: 'cc__ring' });
  camera.append(ring); stage.append(camera); root.append(stage);

  const S = { angle: 0, vel: 0, target: null, dir: -1, press: null, drag: false, hover: false, pointer: { in: false, x: 0, y: 0 }, yaw: 0, pitch: 0,
    intro: null, introDone: false, hold: 0, suppress: false, wheelT: 0, fit: 1, shift: 0, drop: 0, last: 0, paused: false };
  let cardW = 0, cardH = 0, radius = 0, tiles = [], cards = [], active = 0, raf = 0, visible = true, dead = false;

  const build = () => {
    const rect = root.getBoundingClientRect(); if (!rect.width || !rect.height) return false;
    const sz = (O.size ? O.size(rect) : { w: 260, aspect: .5625 });
    const w = Math.round(sz.w), hh = Math.round(sz.w / clamp(sz.aspect, .2, 5));
    if (w === cardW && hh === cardH && cards.length) return true;
    cardW = w; cardH = hh;
    const gap = O.gap + ((Number(O.spread) || 1) - 1) * cardW * .55, n = Math.max(count, 3), pitch = cardW + Math.max(-cardW * .5, gap), chord = pitch / (2 * Math.sin(Math.PI / n)), arc = (n * pitch) / (2 * Math.PI);
    radius = Math.max(chord + (arc - chord) * O.curve, cardW * .6);
    const bend = radius / O.curve;
    tiles = Array.from({ length: TILES }, (_, i) => {
      const len = cardW / TILES, start = i * len - (i > 0 ? OVERLAP / 2 : 0), end = (i + 1) * len + (i < TILES - 1 ? OVERLAP / 2 : 0);
      const c = (start + end) / 2 - cardW / 2, al = c / bend;
      return { i, start, end, size: end - start, move: `translate3d(${bend * Math.sin(al)}px, 0px, ${-bend * (1 - Math.cos(al))}px) rotateY(${al * 180 / Math.PI}deg)` };
    });
    ring.textContent = ''; cards = [];
    items.forEach((it, idx) => {
      const el = h('a', { class: 'cc__card', href: it.href || '#', 'data-cc': idx, draggable: 'false', 'aria-label': it.title || '' });
      if (it.href) el.setAttribute('data-link', '');
      for (const back of (O.light ? [false] : [false, true])) for (const t of tiles) {
        const strip = back ? TILES - 1 - t.i : t.i, first = strip === 0, last = strip === TILES - 1, r = 'var(--cc-radius)';
        const off = back ? cardW - t.end : t.start;
        const tile = h('div', { class: 'cc__tile', style: { left: -t.size / 2 + 'px', top: -cardH / 2 + 'px', width: t.size + 'px', height: cardH + 'px', transform: t.move + (back ? ' rotateY(180deg)' : '') } },
          h('div', { class: 'cc__frame', style: { height: cardH + 'px', borderRadius: `${first ? r : 0} ${last ? r : 0} ${last ? r : 0} ${first ? r : 0}` } },
            h('img', { class: 'cc__photo', src: it.src, alt: '', draggable: 'false', decoding: 'async', style: { left: -off + 'px', width: cardW + 'px', height: cardH + 'px' } }),
            back ? h('div', { class: 'cc__inner' }) : null, h('div', { class: 'cc__shade' })));
        el.append(tile);
      }
      ring.append(el); cards.push(el);
    });
    return true;
  };

  const measure = () => {
    const rect = root.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const width = rect.width * .94, height = rect.height * .92, P = O.perspective;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corners = [[-cardW / 2, -cardH / 2], [cardW / 2, -cardH / 2], [-cardW / 2, cardH / 2], [cardW / 2, cardH / 2]];
    for (let a = -(O.fitAngle || 180); a <= (O.fitAngle || 180); a += 7.5) for (const [cx, cy] of corners) {
      let p = rotX(rotY([cx, cy, radius], a), O.tilt); p = [p[0], p[1], p[2] - radius];
      if (p[2] >= P * .95) continue;
      const k = P / (P - p[2]); minX = Math.min(minX, p[0] * k); maxX = Math.max(maxX, p[0] * k); minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k);
    }
    let fit = Math.min(1, O.fitAngle ? 9e9 : width / Math.max(maxX - minX, 1), height / Math.max(maxY - minY, 1));
    S.fit = fit = fit * (Number(O.zoom) || 1); S.shift = -((minY + maxY) / 2) * fit; S.drop = (rect.height / fit) * .55 + cardH;
    stage.style.perspective = P + 'px'; stage.style.transform = `translate3d(0, ${S.shift}px, 0) scale(${fit})`;
  };

  const nearest = (a) => Math.round(a / step) * step;
  const introMod = (el, base) => {
    if (!S.intro) return 0;
    const reach = Math.abs(wrap(base + S.angle)), p = easeQuint(clamp((el - (reach / 180) * 480) / 900, 0, 1));
    return (1 - p) * S.drop;
  };
  const advance = (dt, now) => {
    if (!S.introDone) { if (!S.intro) { if (!O.intro || O.reduced) S.introDone = true; else S.intro = { start: now }; } if (S.intro && now - S.intro.start >= 1400) { S.intro = null; S.introDone = true; } }
    const paused = S.paused || S.hover || S.drag || now < S.hold;
    const cruise = !O.reduced && !paused && !S.intro ? O.speed * S.dir : 0;
    let busy = !!S.intro || S.drag;
    if (S.drag || S.intro) S.vel = S.drag ? S.vel : 0;
    if (S.intro && O.swerve) { const k = clamp((now - S.intro.start) / 1250, 0, 1); S.angle = O.swerve * 330 * Math.pow(1 - k, 3); } // Einflug: dreht aus einer Richtung herein und bremst sanft ab
    else if (S.target !== null) {
      let rem = dt; const damp = 2 * Math.sqrt(SPRING);
      while (rem > 0) { const k = Math.min(rem, 1 / 240); S.vel += (SPRING * (S.target - S.angle) - damp * S.vel) * k; S.angle += S.vel * k; rem -= k; }
      if (Math.abs(S.target - S.angle) < .004 && Math.abs(S.vel) < .03) { S.angle = S.target; S.vel = 0; S.target = null; }
      busy = true;
    } else {
      const tau = .18 + O.momentum * 1.5;
      S.vel += (cruise - S.vel) * (1 - Math.exp(-dt / tau)); S.angle += S.vel * dt;
      if (cruise === 0 && Math.abs(S.vel) < SETTLE) S.target = nearest(S.angle);
      busy = busy || cruise !== 0 || Math.abs(S.vel) > .01 || S.target !== null;
    }
    if (now < S.hold) busy = true;
    const e = 1 - Math.exp(-dt / .35), ay = S.pointer.in ? S.pointer.x * O.parallax * 9 : 0, ap = S.pointer.in ? -S.pointer.y * O.parallax * 6 : 0;
    S.yaw += (ay - S.yaw) * e; S.pitch += (ap - S.pitch) * e;
    if (Math.abs(ay - S.yaw) > .01 || Math.abs(ap - S.pitch) > .01) busy = true;
    return busy;
  };
  const render = (now) => {
    const el = S.intro ? now - S.intro.start : 0, swell = 1 + O.stretch * .12 * Math.min(1, Math.abs(S.vel) / 420), R = radius * swell;
    camera.style.transform = `translate3d(0, 0, ${-R}px) rotateX(${O.tilt + S.pitch}deg) rotateY(${S.yaw}deg)`;
    ring.style.transform = `rotateY(${S.angle}deg)`;
    cards.forEach((c, i) => {
      const base = i * step, lift = introMod(el, base);
      c.style.transform = `rotateY(${base}deg) translateZ(${R}px)` + (lift ? ` translateY(${lift}px)` : '');
      const facing = Math.cos(wrap(base + S.angle) * RAD);
      c.style.setProperty('--cc-depth', (O.depthFade * Math.pow((1 - facing) / 2, 1.25)).toFixed(3));
      c.style.zIndex = '';
    });
    const idx = ((Math.round(-S.angle / step) % count) + count) % count || 0;
    if (idx !== active) { active = idx; O.onChange && O.onChange(idx); }
  };
  const frame = (now) => {
    raf = 0; if (dead) return;
    const dt = S.last ? Math.min((now - S.last) / 1000, .05) : 1 / 60; S.last = now;
    const busy = S.scrub ? false : advance(dt, now); render(now);
    if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame); else S.last = 0;
  };
  const wake = () => { if (!raf && visible && !document.hidden && !dead) raf = requestAnimationFrame(frame); };

  const ro = new ResizeObserver(() => { if (build()) { measure(); render(performance.now()); } wake(); });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; S.last = 0; } });
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; S.last = 0; } else wake(); };

  // ---- Bedienung: Ziehen, Tippen, Trackpad seitwärts, Tastatur ----
  const perPx = () => (root.clientWidth > 700 ? 2.3 : 1.6) * 180 / (Math.PI * radius * S.fit);
  const down = (e) => { S.suppress = false; if (e.button !== 0) return; S.press = { id: e.pointerId, x: e.clientX, y: e.clientY, angle: S.angle, moved: false, origin: 0, samples: [{ t: performance.now(), a: S.angle }] }; };
  const move = (e) => {
    if (e.pointerType === 'mouse') { S.pointer.in = true; const r = root.getBoundingClientRect(); S.pointer.x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); S.pointer.y = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); }
    const p = S.press; if (!p || p.id !== e.pointerId) { wake(); return; }
    const d = e.clientX - p.x, cross = e.clientY - p.y;
    if (!p.moved) {
      if (Math.abs(d) < DRAG) return;
      if (Math.abs(cross) > Math.abs(d) * 1.2 && e.pointerType !== 'mouse') { S.press = null; return; }
      p.moved = true; p.origin = d; S.drag = true; S.target = null; S.vel = 0; root.classList.add('is-dragging');
      try { root.setPointerCapture(e.pointerId); } catch { /* egal */ }
    }
    S.angle = p.angle + (d - p.origin) * perPx();
    const now = performance.now(); p.samples.push({ t: now, a: S.angle }); while (p.samples.length > 2 && now - p.samples[0].t > 110) p.samples.shift();
    wake();
  };
  const up = (e) => {
    const p = S.press; if (!p || p.id !== e.pointerId) return; S.press = null; if (!p.moved) return;
    S.drag = false; root.classList.remove('is-dragging'); S.suppress = true;
    const f = p.samples[0], l = p.samples[p.samples.length - 1], span = (l.t - f.t) / 1000, v = span > .008 ? clamp((l.a - f.a) / span, -1400, 1400) : 0;
    S.vel = v; if (Math.abs(v) > 60) S.dir = Math.sign(v);
    // Wischen: Schwung mitnehmen und auf die nächste Karte einrasten (kleine Drags springen nicht mehr zurück)
    S.target = nearest(S.angle + clamp(v * .2, -step * 1.5, step * 1.5));
    S.hold = performance.now() + 2200; wake();
  };
  const focus = (i) => { let t = -i * step; t += 360 * Math.round((S.angle - t) / 360); S.target = t; S.hold = performance.now() + 2800; wake(); };
  const click = (e) => {
    const c = e.target.closest && e.target.closest('[data-cc]'); if (S.suppress) { S.suppress = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!c) return; const i = Number(c.getAttribute('data-cc'));
    if (i !== active) { e.preventDefault(); focus(i); return; }
    if (O.onFront) { e.preventDefault(); O.onFront(items[i], i); }
  };
  const wheel = (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0; if (!d) return; e.preventDefault();
    S.target = null; S.angle -= d * perPx(); S.vel = -d * perPx() * 30; S.hold = performance.now() + 1600;
    clearTimeout(S.wheelT); S.wheelT = setTimeout(() => { S.target = nearest(S.angle + S.vel * .12); wake(); }, 140); wake();
  };
  const enter = (e) => { if (e.pointerType === 'mouse') { S.hover = true; wake(); } };
  const leave = (e) => { if (e.pointerType === 'mouse') { S.hover = false; S.pointer.in = false; } wake(); };
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  root.addEventListener('pointerenter', enter); root.addEventListener('pointerleave', leave); root.addEventListener('click', click, true); root.addEventListener('wheel', wheel, { passive: false });
  document.addEventListener('visibilitychange', onVis);

  build(); measure(); render(performance.now()); ro.observe(root); io.observe(root); root.setAttribute('data-ready', ''); wake();
  return {
    // Scroll-gesteuertes Drehen auf Karte 0: begin() merkt den Startwinkel, scrub(0..1) dreht, release() gibt wieder frei
    begin() { if (S.scrub) return; S.a0 = S.angle; S.a1 = 360 * Math.round(S.angle / 360); S.scrub = true; S.target = null; S.vel = 0; S.press = null; S.drag = false; },
    scrub(t) { if (!S.scrub) this.begin(); const e = inOut(clamp(t, 0, 1)); S.angle = S.a0 + (S.a1 - S.a0) * e; S.vel = 0; S.target = null; render(performance.now()); wake(); },
    release() { if (!S.scrub) return; S.scrub = false; S.target = null; S.hold = 0; wake(); },
    focus: (i) => { S.paused = true; focus(i); },
    pause: (on) => { S.paused = !!on; if (!on) S.hold = 0; wake(); },
    get index() { return active; },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); root.removeEventListener('click', click, true); root.removeEventListener('wheel', wheel); },
  };
}
