// Flex-Karussell: eine Bilderreihe, die an einer unsichtbaren Glaslinse sanft abknickt (WebGL2, ohne Bibliothek).
// Vanilla-Port der "FlexCarousel"-Idee. flexCarousel(root, items, opts) -> { destroy() }
//   items: [{ src, title?, subtitle?, href? }]
import { h } from './dom.js';

const PRESETS = {
  liquid: { lensWidth: .74, lensHeight: 1.18, tilt: 62, roundness: 1, bend: .34, reach: .38, curl: 'twist', dispersion: .45 },
  ribbon: { lensWidth: .8, lensHeight: .8, tilt: 0, roundness: 1, bend: .34, reach: .34, curl: 'twist', dispersion: .4 },
  vortex: { lensWidth: .7, lensHeight: .95, tilt: 30, roundness: 1, bend: .46, reach: .3, curl: 'twist', dispersion: .5 },
  arch: { lensWidth: .8, lensHeight: .8, tilt: 0, roundness: 1, bend: .3, reach: .36, curl: 'rise', dispersion: .4 },
};
const FIT = { portrait: .75, square: 1, landscape: 4 / 3 };
const LOW = (typeof matchMedia === 'function') && (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700);
// Handy/Touch: weniger Filter-Samples, kleinere Render-Fläche, kleinere Texturen → flüssig
const TAPS = LOW ? 5 : 12, BUDGET = LOW ? 1.3e6 : 3.2e6, TEXMAX = LOW ? 1024 : 1800, INTRO = { rise: 2.1, bloom: 1.6, spin: 2.2, deal: 1.5, fade: .35 };
const wrap = (v, s) => ((((v + s / 2) % s) + s) % s) - s / 2;
const c01 = (v) => Math.min(Math.max(v, 0), 1);
const easeOut = (v) => 1 - Math.pow(1 - c01(v), 3);
const quint = (v) => 1 - Math.pow(1 - c01(v), 5);
const inOut = (v) => { const t = c01(v); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

const VS_CARD = `#version 300 es
in vec2 position; in vec2 uv;
uniform vec4 uRect; uniform vec2 uResolution;
out vec2 vUv; out vec2 vLocal;
void main(){ vUv = uv; vLocal = vec2(position.x, -position.y) * uRect.zw; vec2 px = uRect.xy + vLocal;
  gl_Position = vec4(px.x / uResolution.x * 2.0 - 1.0, 1.0 - px.y / uResolution.y * 2.0, 0.0, 1.0); }`;
const FS_CARD = `#version 300 es
precision highp float;
uniform sampler2D tMap; uniform vec2 uSize; uniform vec2 uImage; uniform float uRadius; uniform float uAlpha; uniform float uReady; uniform float uShift; uniform float uDpr; uniform vec3 uPlaceholder;
in vec2 vUv; in vec2 vLocal; out vec4 fragColor;
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  float sd = rbox(vLocal, uSize * 0.5, min(uRadius, min(uSize.x, uSize.y) * 0.5));
  float mask = clamp(0.5 - sd * uDpr, 0.0, 1.0);
  vec2 local = vLocal / uSize + 0.5;
  float ca = uSize.x / uSize.y, ia = uImage.x / max(uImage.y, 1.0);
  vec2 scale = ia > ca ? vec2(ca / ia, 1.0) : vec2(1.0, ia / ca);
  scale /= 1.08;
  vec2 uv = vec2(local.x, 1.0 - local.y);
  uv = (uv - 0.5) * scale + 0.5;
  uv.x += uShift * (1.0 - scale.x) * 0.5;
  vec3 image = texture(tMap, uv).rgb;
  vec3 color = mix(uPlaceholder, image, uReady);
  float alpha = mask * uAlpha;
  fragColor = vec4(color * alpha, alpha);
}`;
const VS_LENS = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
const FS_LENS = `#version 300 es
precision highp float;
uniform sampler2D tScene; uniform vec2 uResolution; uniform float uDpr; uniform vec2 uCenter; uniform vec2 uHalf; uniform float uAngle; uniform float uExponent;
uniform float uInner; uniform float uOuter; uniform float uFlow; uniform float uCurl; uniform float uDispersion; uniform float uStrength; uniform float uSceneAlpha;
out vec4 fragColor;
void main(){
  vec2 frag = gl_FragCoord.xy / uDpr; vec2 uv = frag / uResolution;
  vec2 rel = frag - vec2(uCenter.x, uResolution.y - uCenter.y);
  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 local = vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
  vec2 k = max(abs(local) / uHalf, vec2(1e-5));
  float nd = pow(pow(k.x, uExponent) + pow(k.y, uExponent), 1.0 / uExponent);
  vec2 grad = pow(k, vec2(uExponent - 1.0)) * sign(local) / uHalf * pow(nd, 1.0 - uExponent);
  float glen = max(length(grad), 1e-6);
  float edge = (nd - 1.0) / glen;
  vec2 outward = grad / glen;
  vec2 normal = vec2(ca * outward.x - sa * outward.y, sa * outward.x + ca * outward.y);
  vec2 along = vec2(-normal.y, normal.x);
  float t = clamp((edge + uInner) / (uInner + uOuter), 0.0, 1.0);
  float ramp = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float slope = 16.0 * t * t * (1.0 - t) * (1.0 - t);
  float reachX = rel.x / (uResolution.x * 0.5);
  float side = smoothstep(0.02, 0.3, abs(reachX)) * (uCurl == 0.0 ? sign(reachX) : uCurl);
  float lift = ramp * side * uFlow * uStrength;
  vec2 swirl = along * along.y * side * slope * uFlow * uStrength * 0.35;
  vec2 drift = vec2(0.0, -lift) - swirl;
  vec2 shifted = uv + drift / uResolution;
  vec2 texels = uResolution * uDpr;
  vec2 gx = dFdx(shifted), gy = dFdy(shifted);
  gx *= min(1.0, 3.0 / max(length(gx * texels), 1e-4));
  gy *= min(1.0, 3.0 / max(length(gy * texels), 1e-4));
  vec4 color = textureGrad(tScene, shifted, gx, gy);
  vec2 spread = vec2(0.0, side * slope * uFlow * uStrength) / uResolution * uDispersion;
  float spreadPx = length(spread * texels);
  if (color.a > 0.002 && spreadPx > 0.25) {
    vec3 base = color.rgb / color.a; vec3 sumColor = vec3(0.0); vec3 sumWeight = vec3(0.0);
    for (int i = 0; i < ${TAPS}; i++) {
      float s = (float(i) + 0.5) / float(${TAPS});
      vec4 c = textureGrad(tScene, shifted + spread * (s - 0.5), gx, gy);
      vec3 w = max(1.0 - abs(vec3(s) - vec3(0.15, 0.5, 0.85)) * 2.6, 0.0) * c.a;
      sumColor += c.rgb * (w / max(c.a, 0.002)); sumWeight += w;
    }
    vec3 split = mix(base, sumColor / max(sumWeight, vec3(1e-4)), clamp(sumWeight * 2.0, 0.0, 1.0));
    color.rgb = mix(color.rgb, clamp(split, 0.0, 1.0) * color.a, smoothstep(0.25, 1.5, spreadPx));
  }
  fragColor = color * uSceneAlpha;
}`;

function program(gl, vs, fs) {
  const mk = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
  return { p, loc };
}

export function flexCarousel(root, items, o = {}) {
  const S0 = { preset: 'liquid', intro: 'rise', fit: 'natural', cardHeight: .5, gap: 12, radius: 0, squeeze: .2, autoplay: false, interval: 4, focusOnClick: false, captions: true, captureWheel: false, ...o };
  const base = PRESETS[S0.preset] || PRESETS.liquid;
  const s = { ...S0, ...base };
  if (LOW) { s.bend = (s.bend || 0) * .3; s.dispersion = 0; if (s.squeeze) s.squeeze *= .6; }
  root.classList.add('fc');
  const canvas = h('canvas', { class: 'fc__canvas', 'aria-hidden': 'true' });
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) return null;
  root.prepend(canvas);
  const capTitle = h('span', { class: 'fc__title' }), capCount = h('span', { class: 'fc__count' });
  const caption = h('div', { class: 'fc__caption', 'aria-hidden': 'true' }, capTitle, capCount); if (s.captions) root.append(caption);
  root.style.setProperty('--fc-half', `${Math.min(Math.max(s.cardHeight, .05), 1) * 50}%`);
  gl.clearColor(0, 0, 0, 0);

  const card = program(gl, VS_CARD, FS_CARD), lens = program(gl, VS_LENS, FS_LENS);
  const quad = gl.createVertexArray(); gl.bindVertexArray(quad);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, 0, 0, .5, -.5, 1, 0, -.5, .5, 0, 1, .5, .5, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(card.p);
  const ap = gl.getAttribLocation(card.p, 'position'), au = gl.getAttribLocation(card.p, 'uv');
  gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(au); gl.vertexAttribPointer(au, 2, gl.FLOAT, false, 16, 8);
  const tri = gl.createVertexArray(); gl.bindVertexArray(tri);
  const tb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(lens.p, 'position'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);

  const target = { tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 2, h: 2 };
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let slots = [], width = 1, height = 1, dpr = 1, pos = 0, vel = 0, goal = 0, mode = 'spring', wheelAt = 0, raf = 0, last = performance.now(), visible = true, alive = true, dirty = true;
  let activeIndex = -1, interactedAt = -Infinity, autoplayAt = performance.now(), hasFocus = false, deform = 0, deformVel = 0, layout = null, hover = '', lift = 1, energy = 0, lastPos = 0, instances = [];
  const L = { x: 0, y: 0, vx: 0, vy: 0, ready: false };
  const P = { x: 0, y: 0, over: false, down: false, id: -1, startX: 0, startY: 0, startPos: 0, dragging: false, touch: false, samples: [] };
  const I = { kind: 'none', t: 0, running: false, done: false, readyAt: 0 };
  const F = { index: -1, pending: -1, t: 0, v: 0, target: 0 };

  const setTarget = () => {
    gl.bindTexture(gl.TEXTURE_2D, target.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, target.w, target.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  let near = false; const gate = [];
  const loadSlot = (item, index) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    const slot = { item, index, tex, aspect: .8, loaded: false, failed: false, ready: 0, color: [.5, .5, .5], image: [1, 1], dispose: () => {} };
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => {
      if (!alive || !slots.includes(slot)) return;
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      let src = img; const big = Math.max(img.naturalWidth, img.naturalHeight);
      if (big > TEXMAX) { const k = TEXMAX / big, cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); src = cv; }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, LOW ? 2 : 8);
      slot.image = [img.naturalWidth || 1, img.naturalHeight || 1]; slot.aspect = slot.image[0] / slot.image[1];
      try { const c = document.createElement('canvas'); c.width = c.height = 8; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, 8, 8); const d = cx.getImageData(0, 0, 8, 8).data; const a = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { a[0] += d[i]; a[1] += d[i + 1]; a[2] += d[i + 2]; } slot.color = a.map(v => v / 64 / 255); } catch { slot.color = [.5, .5, .5]; }
      slot.loaded = true; dirty = true; start();
    };
    img.onerror = () => { if (!alive) return; slot.failed = true; dirty = true; start(); };
    if (near) img.src = item.src; else gate.push(() => { img.src = item.src; });
    slot.dispose = () => { img.onload = img.onerror = null; gl.deleteTexture(tex); };
    return slot;
  };
  const setItems = (next) => { slots.forEach(x => x.dispose()); slots = next.map(loadSlot); activeIndex = -1; layout = null; resnap = true; F.target = 0; F.t = 0; F.v = 0; F.pending = -1; root.classList.remove('is-open'); I.readyAt = performance.now(); dirty = true; start(); };
  let resnap = false;

  const metrics = () => {
    const cardH = Math.max(24, s.cardHeight * height), fixed = typeof s.fit === 'number' ? s.fit : FIT[s.fit], widths = slots.map(x => (fixed || x.aspect) * cardH), centers = []; let cur = 0;
    for (let i = 0; i < widths.length; i++) { centers.push(cur + widths[i] / 2); cur += widths[i] + s.gap; }
    return { cardH, widths, centers, gap: s.gap, loop: Math.max(cur, 1) };
  };
  const nearest = (m, at) => { let b = 0, bd = Infinity; for (let i = 0; i < m.centers.length; i++) { const d = Math.abs(wrap(m.centers[i] - at, m.loop)); if (d < bd) { bd = d; b = i; } } return b; };
  const snapPoint = (m, at) => { const i = nearest(m, at); return at + wrap(m.centers[i] - at, m.loop); };
  const remap = (from, to, at) => { const i = nearest(from, at), off = wrap(at - from.centers[i], from.loop), cyc = Math.round((at - off - from.centers[i]) / from.loop); return cyc * to.loop + to.centers[i] + off * (to.widths[i] / from.widths[i]); };
  const step = (m, delta) => {
    let at = snapPoint(m, goal), index = nearest(m, at); const n = m.centers.length;
    for (let k = 0; k < Math.abs(delta); k++) { const nx = (index + (delta > 0 ? 1 : n - 1)) % n; at += delta > 0 ? m.widths[index] / 2 + m.gap + m.widths[nx] / 2 : -(m.widths[nx] / 2 + m.gap + m.widths[index] / 2); index = nx; }
    goal = at; mode = 'spring'; dirty = true; start();
  };
  const goTo = (m, index) => { const i = ((index % m.centers.length) + m.centers.length) % m.centers.length; goal = goal + wrap(m.centers[i] - goal, m.loop); mode = 'spring'; dirty = true; start(); };
  const openFocus = (i) => { F.index = i; F.pending = -1; F.target = 1; root.classList.add('is-open'); dirty = true; start(); };
  const closeFocus = () => { F.pending = -1; if (F.target === 0) return false; F.target = 0; root.classList.remove('is-open'); dirty = true; start(); return true; };
  const skipIntro = () => { if (I.running) I.t = 1; };
  const reveal = () => root.classList.add('is-revealed');

  const introFx = () => {
    const t = I.running ? I.t : I.done ? 1 : 0, e = { sceneAlpha: 1, strength: 1, card: null };
    if (!I.done && !I.running) { e.sceneAlpha = 0; e.strength = 0; return e; }
    if (t >= 1) return e;
    const k = I.kind;
    if (k === 'rise') { e.strength = inOut((t - .3) / .65); e.card = (rel) => { const d = Math.min(Math.abs(rel) / (width * .6), 1) * .34, l = c01((t - d) / .6); return { alpha: c01(l * 4), x: 0, y: (1 - quint(l)) * height * .62, scale: .5 + .5 * inOut((l - .18) / .82) }; }; }
    else if (k === 'bloom') { e.strength = inOut((t - .2) / .8); e.card = (rel) => { const d = Math.min(Math.abs(rel) / (width * .6), 1) * .25, l = easeOut((t - d) / .55); return { alpha: l, x: 0, y: 0, scale: .92 + .08 * l }; }; }
    else if (k === 'spin') { e.sceneAlpha = easeOut(t / .25); e.strength = easeOut((t - .55) / .45); }
    else if (k === 'deal') { e.strength = easeOut((t - .45) / .5); e.card = (rel) => { const sp = Math.min(Math.abs(rel) / (width * .6), 1) * .3, l = easeOut((t - .12 - sp) / .5); return { alpha: easeOut((t - sp) / .12), x: -rel * (1 - l), y: 0, scale: 1 }; }; }
    else { e.sceneAlpha = easeOut(t); e.strength = easeOut(t); }
    return e;
  };
  const beginIntro = (m) => {
    const kind = reduced && s.intro !== 'none' ? 'fade' : s.intro;
    I.kind = INTRO[kind] ? kind : 'none'; I.running = I.kind !== 'none'; I.done = !I.running; I.t = 0; if (I.done) reveal();
    if (I.kind === 'spin') { const d = m.loop * 1.6 + width; pos = goal + d; vel = -d * 3; mode = 'spring'; }
  };

  const resize = () => {
    width = Math.max(1, root.clientWidth); height = Math.max(1, root.clientHeight);
    dpr = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2, Math.sqrt(BUDGET / (width * height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = '100%'; canvas.style.height = '100%';
    target.w = Math.max(2, Math.round(width * dpr)); target.h = Math.max(2, Math.round(height * dpr)); setTarget(); dirty = true; start();
  };

  const u = (pr, name, ...v) => { const l = pr.loc[name]; if (l == null) return; if (v.length === 1 && typeof v[0] === 'number') gl.uniform1f(l, v[0]); else if (v.length === 1) { const a = v[0]; a.length === 2 ? gl.uniform2fv(l, a) : a.length === 3 ? gl.uniform3fv(l, a) : gl.uniform4fv(l, a); } else if (v.length === 2) gl.uniform2f(l, v[0], v[1]); };

  const frame = (now) => {
    raf = 0; if (!alive) return;
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
    if (!slots.length) { if (visible) raf = requestAnimationFrame(frame); return; }
    const m = metrics(), n = slots.length; let animating = false;
    if (resnap) { goal = snapPoint(m, goal); pos = goal; vel = 0; resnap = false; }
    else if (layout && layout.loop !== m.loop) { pos = remap(layout, m, pos); goal = remap(layout, m, goal); P.startPos = pos + (P.x - P.startX); animating = true; }
    layout = m;
    if (!I.running && !I.done) { const all = slots.every(x => x.loaded || x.failed); if (all || now - I.readyAt > 3500) { goal = snapPoint(m, goal); pos = goal; beginIntro(m); } }
    if (I.running) { I.t = Math.min(1, I.t + dt / (INTRO[I.kind] || 1)); if (I.t >= 1) { I.running = false; I.done = true; reveal(); } animating = true; }
    if (mode === 'wheel' && now - wheelAt > 150) { goal = snapPoint(m, goal); mode = 'spring'; }
    if (!P.dragging) {
      const spinning = I.running && I.kind === 'spin', k = spinning ? 9 : mode === 'wheel' ? 80 : 55, damp = 2 * Math.sqrt(k), steps = Math.ceil(dt / (1 / 240)), hh = dt / steps;
      for (let i = 0; i < steps; i++) { vel += (k * (goal - pos) - damp * vel) * hh; pos += vel * hh; }
      if (Math.abs(goal - pos) < .05 && Math.abs(vel) < .5) { pos = goal; vel = 0; } else animating = true;
    } else animating = true;
    if (Math.abs(pos) > m.loop * 8) { const sh = Math.round(pos / m.loop) * m.loop; pos -= sh; goal -= sh; P.startPos -= sh; }
    const cur = nearest(m, pos);
    if (cur !== activeIndex) { activeIndex = cur; capTitle.textContent = items[cur].title || ''; capTitle.dataset.sub = items[cur].subtitle || ''; capTitle.style.animation = 'none'; void capTitle.offsetWidth; capTitle.style.animation = ''; capCount.textContent = `${String(cur + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`; o.onChange && o.onChange(cur, items[cur]); }
    if (F.pending >= 0 && mode === 'spring' && Math.abs(goal - pos) < 1.5 && Math.abs(vel) < 30) { if (cur === F.pending) openFocus(cur); else F.pending = -1; }
    if (s.autoplay && !reduced && I.done && F.target === 0 && F.t < .01 && !P.over && !P.down && !hasFocus && mode === 'spring' && Math.abs(goal - pos) < 1 && now - interactedAt > 3000 && now - autoplayAt > s.interval * 1000) { autoplayAt = now; step(m, 1); }
    if (s.autoplay && !reduced) animating = true;
    const travel = Math.abs(pos - lastPos) / dt; lastPos = pos;
    const eT = reduced ? 0 : Math.min(travel / 2600, 1); energy += (eT - energy) * (1 - Math.exp(-dt / (eT > energy ? .07 : .35))); if (energy > .001) animating = true;
    const push = Math.max(-1, Math.min(1, vel / 2200)); deformVel += (120 * (push - deform) - 2 * Math.sqrt(120) * .32 * deformVel) * dt; deform += deformVel * dt; if (Math.abs(deform) > .0005 || Math.abs(deformVel) > .005) animating = true;
    F.v += (64 * (F.target - F.t) - 2 * Math.sqrt(64) * F.v) * dt; F.t += F.v * dt;
    if (Math.abs(F.target - F.t) < .0005 && Math.abs(F.v) < .001) { F.t = F.target; F.v = 0; } else animating = true;
    const fa = c01(F.t), fe = inOut(fa), fw = F.index >= 0 && F.index < n ? m.widths[F.index] : m.cardH, fs = Math.max(1, Math.min(1.3, (height * .84) / m.cardH, (width * .92) / fw)), nl = 1 + (fs - 1) * fe;
    if (Math.abs(nl - lift) > .0005) { lift = nl; root.style.setProperty('--fc-lift', lift.toFixed(4)); }
    const fx = introFx(), homeX = width / 2, homeY = height / 2;
    const follow = false;
    if (!L.ready) { L.x = homeX; L.y = homeY; L.ready = true; }
    L.vx += (110 * (homeX - L.x) - 2 * Math.sqrt(110) * .8 * L.vx) * dt; L.vy += (110 * (homeY - L.y) - 2 * Math.sqrt(110) * .8 * L.vy) * dt; L.x += L.vx * dt; L.y += L.vy * dt;
    for (const x of slots) if (x.loaded && x.ready < 1) { x.ready = Math.min(1, x.ready + dt / .45); animating = true; }
    const halfW = (s.lensWidth * width) / 2, halfH = (s.lensHeight * width) / 2;
    const waiting = !I.done;
    if (dirty || animating || P.dragging) {
      dirty = false; instances = [];
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(card.p); gl.bindVertexArray(quad);
      u(card, 'uResolution', [width, height]); u(card, 'uDpr', dpr); u(card, 'uRadius', s.radius);
      const shrink = 1 - c01(s.squeeze) * energy, draws = [];
      for (let i = 0; i < n; i++) {
        const w = m.widths[i], baseRel = wrap(m.centers[i] - pos, m.loop);
        for (let k = -3; k <= 3; k++) {
          const rel = baseRel + k * m.loop, f = fx.card ? fx.card(rel) : null;
          if (Math.abs(rel) - w / 2 > width + 40) continue;
          let x = homeX + rel + (f ? f.x : 0), sc = shrink * (f ? f.scale : 1), alpha = f ? f.alpha : 1;
          if (fa > 0) { if (i === F.index && Math.abs(rel) < w) sc *= 1 + (fs - 1) * fe; else { const ord = Math.min(Math.abs(rel) / width, 1) * .25, part = inOut(fa * 1.25 - ord); x += Math.sign(rel) * part * width * .7; alpha *= 1 - part; } }
          const cw = w * sc; if (alpha <= .001 || x + cw / 2 < -40 || x - cw / 2 > width + 40) continue;
          draws.push({ i, rel, x, y: homeY + (f ? f.y : 0), cw, ch: m.cardH * sc, alpha });
        }
      }
      draws.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
      for (const d of draws) {
        const sl = slots[d.i]; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sl.tex); gl.uniform1i(card.loc.tMap, 0);
        u(card, 'uRect', [d.x, d.y, d.cw + 2, d.ch + 2]); u(card, 'uSize', [d.cw, d.ch]); u(card, 'uImage', sl.image); u(card, 'uAlpha', d.alpha); u(card, 'uReady', sl.ready);
        u(card, 'uShift', reduced ? 0 : Math.max(-1, Math.min(1, d.rel / (width * .75)))); u(card, 'uPlaceholder', sl.color);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        instances.push({ index: d.i, x0: d.x - d.cw / 2, x1: d.x + d.cw / 2, y0: d.y - d.ch / 2, y1: d.y + d.ch / 2 });
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, target.tex); gl.generateMipmap(gl.TEXTURE_2D);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.disable(gl.BLEND); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(lens.p); gl.bindVertexArray(tri); gl.uniform1i(lens.loc.tScene, 0);
      u(lens, 'uResolution', [width, height]); u(lens, 'uDpr', dpr); u(lens, 'uCenter', [L.x - deform * 0, L.y]); u(lens, 'uHalf', [Math.max(halfW, 1), Math.max(halfH, 1)]);
      u(lens, 'uAngle', (s.tilt * Math.PI) / 180); u(lens, 'uExponent', 2 + Math.pow(1 - c01(s.roundness), 1.5) * 10);
      const inner = Math.max(4, s.reach * (Math.max(halfW, 1) + Math.max(halfH, 1)) * .5);
      u(lens, 'uInner', inner); u(lens, 'uOuter', inner * 1.6); u(lens, 'uFlow', s.bend * (Math.max(halfW, 1) + Math.max(halfH, 1)) * .45);
      u(lens, 'uCurl', s.curl === 'rise' ? 1 : s.curl === 'fall' ? -1 : 0); u(lens, 'uDispersion', s.dispersion * .12); u(lens, 'uStrength', fx.strength * (1 - fe)); u(lens, 'uSceneAlpha', fx.sceneAlpha);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    let nh = '';
    if (P.over && !P.dragging && I.done && s.focusOnClick) { const hit = instances.find(i => P.x >= i.x0 && P.x <= i.x1 && P.y >= i.y0 && P.y <= i.y1); if (F.target > 0) nh = 'close'; else if (hit) nh = 'open'; }
    if (nh !== hover) { hover = nh; nh ? root.setAttribute('data-hover', nh) : root.removeAttribute('data-hover'); }
    if (visible && (animating || waiting || dirty || P.down)) raf = requestAnimationFrame(frame);
  };
  const start = () => { if (raf || !visible || !alive) return; last = performance.now(); raf = requestAnimationFrame(frame); };
  const lp = (e) => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const down = (e) => {
    if (e.button !== undefined && e.button > 0) return; skipIntro(); const [x, y] = lp(e);
    P.down = true; P.id = e.pointerId; P.touch = e.pointerType === 'touch'; P.startX = P.x = x; P.startY = P.y = y; P.startPos = pos; P.dragging = false; P.samples = [{ x, t: performance.now() }]; interactedAt = performance.now();
    if (Math.abs(vel) > 40) { goal = pos; vel = 0; } dirty = true; start();
  };
  const move = (e) => {
    const [x, y] = lp(e); P.x = x; P.y = y; P.over = true;
    if (P.down && e.pointerId === P.id) {
      const dx = x - P.startX, dy = y - P.startY, slop = P.touch ? 10 : 5;
      if (!P.dragging) {
        if (P.touch && Math.abs(dy) > slop && Math.abs(dy) > Math.abs(dx)) { P.down = false; return; }
        if (Math.abs(dx) > slop) { P.dragging = true; P.startX = x; P.startPos = pos; closeFocus(); try { root.setPointerCapture(e.pointerId); } catch { /* egal */ } root.setAttribute('data-dragging', ''); }
      }
      if (P.dragging) { pos = P.startPos - (x - P.startX); goal = pos; vel = 0; const now = performance.now(); P.samples.push({ x, t: now }); while (P.samples.length > 2 && now - P.samples[0].t > 100) P.samples.shift(); }
    }
    dirty = true; start();
  };
  const up = (e) => {
    if (!P.down || e.pointerId !== P.id) return; P.down = false; root.removeAttribute('data-dragging');
    const m = metrics(); interactedAt = performance.now();
    if (P.dragging) {
      P.dragging = false; const now = performance.now(), f = P.samples[0], l = P.samples[P.samples.length - 1]; let v = 0;
      if (f && l && l.t > f.t && now - l.t < 70) v = -((l.x - f.x) / (l.t - f.t)) * 1000;
      vel = v; const landing = snapPoint(m, pos + v * .32); goal = landing; if (Math.abs(v) > 400 && Math.abs(landing - pos) < 1) step(m, v > 0 ? 1 : -1); mode = 'spring'; start(); return;
    }
    if (closeFocus()) return;
    const [x, y] = lp(e), hit = instances.find(i => x >= i.x0 && x <= i.x1 && y >= i.y0 && y <= i.y1); if (!hit) return;
    if (hit.index === activeIndex && Math.abs(goal - pos) < 2) { o.onSelect && o.onSelect(items[hit.index], hit.index); if (s.focusOnClick) openFocus(hit.index); }
    else { goal = snapPoint(m, pos + ((hit.x0 + hit.x1) / 2 - width / 2)); mode = 'spring'; if (s.focusOnClick) F.pending = hit.index; start(); }
  };
  const leave = () => { P.over = false; dirty = true; start(); };
  const cancel = () => { P.down = false; P.dragging = false; root.removeAttribute('data-dragging'); goal = snapPoint(metrics(), pos); mode = 'spring'; start(); };
  const wheel = (e) => {
    if (e.ctrlKey) return; let dx = e.deltaX, dy = e.deltaY; if (e.shiftKey && Math.abs(dx) < Math.abs(dy)) { dx = dy; dy = 0; }
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1, hz = Math.abs(dx) > Math.abs(dy); if (!hz && !s.captureWheel) return;
    e.preventDefault(); skipIntro(); interactedAt = performance.now(); if (closeFocus()) return;
    goal += Math.max(-120, Math.min(120, (hz ? dx : dy) * unit)) * 1.25; mode = 'wheel'; wheelAt = performance.now(); start();
  };
  const key = (e) => {
    const m = metrics();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); skipIntro(); closeFocus(); interactedAt = performance.now(); step(m, 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); skipIntro(); closeFocus(); interactedAt = performance.now(); step(m, -1); }
    else if (e.key === 'Home') { e.preventDefault(); closeFocus(); goTo(m, 0); } else if (e.key === 'End') { e.preventDefault(); closeFocus(); goTo(m, slots.length - 1); }
    else if (e.key === 'Escape') { if (closeFocus()) e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (closeFocus() || activeIndex < 0) return; o.onSelect && o.onSelect(items[activeIndex], activeIndex); if (s.focusOnClick) openFocus(activeIndex); }
  };
  const onFocus = () => { hasFocus = true; }, onBlur = () => { hasFocus = false; }, onVis = () => { if (!document.hidden) start(); };
  root.tabIndex = 0;
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointerleave', leave); root.addEventListener('pointercancel', cancel);
  root.addEventListener('wheel', wheel, { passive: false }); root.addEventListener('keydown', key); root.addEventListener('focus', onFocus); root.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(root);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; start(); }); io.observe(root);
  const io2 = new IntersectionObserver(([en]) => { if (en.isIntersecting && !near) { near = true; io2.disconnect(); gate.splice(0).forEach(f => f()); } }, { rootMargin: '700px 0px' }); io2.observe(root);
  resize(); setItems(items);
  return { destroy() { alive = false; visible = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); slots.forEach(x => x.dispose()); gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); } };
}
