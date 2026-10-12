import { h } from '../core/dom.js';
import { track, still, clamp, trackProgress } from '../core/scrollhub.js';
// 3D-Flug: Beim Scrollen fliegt die Kamera durch einen dunklen Raum. Die Projekte hängen als Bild-Flächen im Raum,
// dazu Drahtgitter-Würfel, Punktwolke und Bodenraster. Glitch (RGB-Versatz, Streifen) reagiert auf Scroll-Tempo.
// Reines WebGL ohne Bibliothek. Ohne WebGL/mit reduzierter Bewegung erscheint eine ruhige Bildergalerie.

/* ---- kleine Matrix-Helfer (spaltenweise) ---- */
const M = {
  id: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0]); },
  tr(x, y, z) { const m = M.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  sc(x, y, z) { const m = M.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
};
const SP = 4.6;  // Abstand der Projekte entlang der Flugbahn

const VS_Q = 'attribute vec2 aPos;attribute vec2 aUv;uniform mat4 uMVP;varying vec2 vUv;void main(){vUv=aUv;gl_Position=uMVP*vec4(aPos,0.,1.);}';
const FS_Q = `precision mediump float;uniform sampler2D uTex;uniform float uA,uG,uT,uSeed,uHover;varying vec2 vUv;
float hh(float n){return fract(sin(n*91.345+uSeed*17.1)*43758.5453);}
void main(){vec2 uv=vUv;float band=floor(uv.y*16.+floor(uT*7.));float r=hh(band);float g=uG*step(.5,r);uv.x+=g*(r-.5)*.3;
float s=uG*.03*(.4+r)+uHover*.004;vec3 c;c.r=texture2D(uTex,uv+vec2(s,0.)).r;c.g=texture2D(uTex,uv).g;c.b=texture2D(uTex,uv-vec2(s,0.)).b;
c*=.93+.07*sin(uv.y*700.);c+=g*.12;float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));c=mix(c,vec3(.7,.85,1.),smoothstep(.01,.0,e)*(.35+uHover*.5));
gl_FragColor=vec4(c*uA,uA);}`;
const VS_L = 'attribute vec3 aPos;uniform mat4 uMVP;varying float vD;void main(){gl_Position=uMVP*vec4(aPos,1.);vD=gl_Position.w;}';
const FS_L = 'precision mediump float;uniform vec4 uC;varying float vD;void main(){float a=uC.a*clamp(1.-vD/16.,0.,1.);gl_FragColor=vec4(uC.rgb*a,a);}';
const VS_P = 'attribute vec3 aPos;uniform mat4 uMVP;uniform float uS;varying float vD;void main(){gl_Position=uMVP*vec4(aPos,1.);vD=gl_Position.w;gl_PointSize=max(1.,uS/gl_Position.w);}';
const FS_P = 'precision mediump float;uniform vec3 uC;varying float vD;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=(1.-d*2.)*clamp(1.-vD/18.,0.,1.);gl_FragColor=vec4(uC*a,a);}';

function prog(gl, vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u, a: (nm) => gl.getAttribLocation(p, nm) };
}
const buf = (gl, data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };

function fallback(list) {
  return h('div', { class: 'ft__fallback' }, list.map(pr => h('a', { class: 'ft__fb', href: pr.slug, 'data-link': '' }, h('img', { src: pr.image, alt: '', loading: 'lazy' }), h('span', {}, pr.title))));
}

export default {
  type: 'flythrough', label: '3D-Flug (Projekte im Raum)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile', type: 'text', default: 'scroll to fly' },
    { name: 'glitch', label: 'Glitch-Stärke (0–2)', type: 'number', default: 1 },
    { name: 'accent', label: 'Akzentfarbe (Hex)', type: 'text', default: '#6fb4ff' },
    { name: 'max', label: 'Max. Anzahl Projekte', type: 'number', default: 6 },
  ],
  render(p, ctx) {
    const idx = ctx.content.index;
    const list = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden).slice(0, Math.max(2, p.max || 6));
    const n = list.length;
    const canvas = h('canvas', { class: 'ft__cv', 'aria-hidden': 'true' });
    let gl = null;
    if (!still()) { try { gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: true, alpha: false }); } catch { gl = null; } }
    if (!gl || n < 2) return h('section', { class: 'ft ft--static', id: p.id }, fallback(list));

    const title = h('h3', { class: 'ft__title' }), roles = h('p', { class: 'ft__roles' }), count = h('p', { class: 'ft__count' });
    const cta = h('a', { class: 'ft__cta', href: list[0].slug, 'data-link': '' }, 'open project ↗');
    const hud = h('div', { class: 'ft__hud' }, count, title, roles, cta);
    const hint = h('p', { class: 'ft__hint' }, p.kicker || '');
    const stage = h('div', { class: 'ft__stage' }, h('div', { class: 'ft__clip' }, canvas, h('div', { class: 'ft__vig' })), hud, hint);
    const el = h('section', { class: 'ft', id: p.id, style: { '--n': n } }, h('div', { class: 'ft__track' }, stage));

    /* ---- GL-Setup ---- */
    let Q, L, P;
    try { Q = prog(gl, VS_Q, FS_Q); L = prog(gl, VS_L, FS_L); P = prog(gl, VS_P, FS_P); } catch (e) { console.warn('[flythrough] shader', e); return h('section', { class: 'ft ft--static', id: p.id }, fallback(list)); }
    const quad = buf(gl, new Float32Array([-.5,-.5,0,0, .5,-.5,1,0, -.5,.5,0,1, .5,.5,1,1]));
    const cube = buf(gl, new Float32Array([-1,-1,-1,1,-1,-1, 1,-1,-1,1,1,-1, 1,1,-1,-1,1,-1, -1,1,-1,-1,-1,-1, -1,-1,1,1,-1,1, 1,-1,1,1,1,1, 1,1,1,-1,1,1, -1,1,1,-1,-1,1, -1,-1,-1,-1,-1,1, 1,-1,-1,1,-1,1, 1,1,-1,1,1,1, -1,1,-1,-1,1,1]));
    const gridLines = []; const Z0 = 10, Z1 = -(n * SP + 6);
    for (let x = -12; x <= 12; x += 2) gridLines.push(x, -1.7, Z0, x, -1.7, Z1);
    for (let z = Z0; z >= Z1; z -= 2) gridLines.push(-12, -1.7, z, 12, -1.7, z);
    const grid = buf(gl, new Float32Array(gridLines)); const gridN = gridLines.length / 3;
    const rnd = (a) => (Math.sin(a * 12.9898) * 43758.5453) % 1;
    const pts = []; const NP = innerWidth < 700 ? 380 : 800;
    for (let i = 0; i < NP; i++) pts.push((Math.abs(rnd(i + 1)) - .5) * 14, (Math.abs(rnd(i + 99)) - .5) * 8, 4 - Math.abs(rnd(i + 7)) * (n * SP + 12));
    const points = buf(gl, new Float32Array(pts));
    const accent = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(p.accent || ''); const v = m ? parseInt(m[1], 16) : 0x6fb4ff; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; })();

    const planes = list.map((pr, i) => ({ pr, i, tex: null, ratio: 1.5, side: i % 2 ? 1 : -1, seed: i + 1 }));
    planes.forEach((pl) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = () => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        pl.tex = t; pl.ratio = img.naturalWidth / img.naturalHeight;
      };
      img.src = pr_src(pl.pr.image);
    });
    function pr_src(s) { return new URL(s, document.baseURI).href; }

    /* ---- Zustand ---- */
    let W = 1, Hh = 1, prog0 = 0, prevP = 0, vel = 0, gl_ = 0, px = 0, py = 0, tpx = 0, tpy = 0, active = -1, hover = -1, running = false, t0 = performance.now();
    const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; Hh = canvas.clientHeight; canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(Hh * dpr)); };
    addEventListener('resize', resize);
    const narrow = () => W / Hh < .8;
    const setActive = (i) => {
      if (i === active) return; active = i; const pr = list[i];
      title.textContent = pr.title || pr.slug; title.dataset.text = pr.title || pr.slug;
      roles.textContent = String(pr.roles || '').split(',').map(s => s.trim()).filter(Boolean).join(' · ');
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`; cta.href = pr.slug;
      title.classList.remove('is-glitch'); void title.offsetWidth; title.classList.add('is-glitch');
    };
    setActive(0);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); tpx = ((e.clientX - r.left) / r.width) * 2 - 1; tpy = ((e.clientY - r.top) / r.height) * 2 - 1; pointer = [e.clientX - r.left, e.clientY - r.top]; });
      stage.addEventListener('pointerleave', () => { tpx = tpy = 0; pointer = null; });
    }
    let pointer = null; const proj = [];
    stage.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; const r = stage.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      for (const pl of planes.slice().sort((a, b) => (b.z || 0) - (a.z || 0))) { const q = proj[pl.i]; if (q && x > q[0] && x < q[2] && y > q[1] && y < q[3]) { document.dispatchEvent(new CustomEvent('app:navigate', { detail: { href: pl.pr.slug } })); window.dispatchEvent(new CustomEvent('app:navigate', { detail: { href: pl.pr.slug } })); return; } }
    });

    const draw = (now) => {
      if (!running) return; requestAnimationFrame(draw);
      const t = (now - t0) / 1000; px += (tpx - px) * .06; py += (tpy - py) * .06;
      vel += (Math.abs(prog0 - prevP) * 90 - vel) * .2; prevP = prog0;
      const spike = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 5.1) - .86) * 6;       // seltene Glitch-Spitzen
      gl_ += ((clamp(vel) + spike) * (p.glitch ?? 1) - gl_) * .3;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.02, .03, .06, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const asp = W / Hh, f = prog0 * (n - 1);
      const camZ = 3.1 - f * SP, camX = Math.sin(f * 1.3) * (narrow() ? .12 : .4), camY = Math.cos(f * .9) * .12;
      const P_ = M.persp(.96, asp, .1, 40);
      const V = M.mul(M.mul(M.rx(py * .05), M.ry(px * .09)), M.tr(-camX, -camY, -camZ));
      const VP = M.mul(P_, V);
      // Boden + Gitter
      gl.useProgram(L.p); gl.bindBuffer(gl.ARRAY_BUFFER, grid); let a = L.a('aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(L.u.uMVP, false, VP); gl.uniform4f(L.u.uC, accent[0], accent[1], accent[2], .16); gl.drawArrays(gl.LINES, 0, gridN);
      // Drahtgitter-Würfel
      gl.bindBuffer(gl.ARRAY_BUFFER, cube); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
      for (let i = 0; i < n * 2; i++) {
        const side = i % 2 ? 1 : -1, zz = -(i * .5 + .25) * SP, s = (.35 + (i % 3) * .18) * (narrow() ? .7 : 1);
        const m = M.mul(M.tr(side * (narrow() ? 1.1 : 2.6) + Math.sin(t * .4 + i) * .15, Math.sin(t * .5 + i * 2) * .7, zz), M.mul(M.mul(M.ry(t * .35 + i), M.rx(t * .22 + i * .7)), M.sc(s, s, s)));
        gl.uniformMatrix4fv(L.u.uMVP, false, M.mul(VP, m)); gl.uniform4f(L.u.uC, accent[0], accent[1], accent[2], .55); gl.drawArrays(gl.LINES, 0, 24);
      }
      // Punkte
      gl.useProgram(P.p); gl.bindBuffer(gl.ARRAY_BUFFER, points); a = P.a('aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(P.u.uMVP, false, VP); gl.uniform1f(P.u.uS, 16 * Math.min(devicePixelRatio || 1, 2)); gl.uniform3f(P.u.uC, .85, .92, 1); gl.drawArrays(gl.POINTS, 0, NP);
      // Projekt-Flächen (hinten nach vorn)
      gl.useProgram(Q.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad); const ap = Q.a('aPos'), au = Q.a('aUv');
      gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(au); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(au, 2, gl.FLOAT, false, 16, 8);
      gl.uniform1i(Q.u.uTex, 0); gl.uniform1f(Q.u.uT, t);
      let near = 0, nd = 1e9; hover = -1;
      for (const pl of planes.slice().reverse()) {
        if (!pl.tex) continue;
        const z = -pl.i * SP, d = camZ - z; pl.z = z; proj[pl.i] = null; if (Math.abs(f - pl.i) < nd) { nd = Math.abs(f - pl.i); near = pl.i; }
        if (d < .6 || d > 15) continue;
        const wN = narrow(); const wd = wN ? 1.42 : 1.9, ht = wd / pl.ratio, x = wN ? pl.side * .12 : pl.side * 1.05, y = wN ? .1 : -.02 + Math.sin(pl.i * 2) * .1;
        const rot = (wN ? .12 : .32) * -pl.side, ang = rot + Math.sin(t * .6 + pl.i) * .02;
        const m = M.mul(M.mul(M.tr(x, y, z), M.ry(ang)), M.sc(wd, ht, 1)), mvp = M.mul(VP, m);
        // Bildschirm-Rechteck für Klicks/Hover
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [cx, cy] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) { const w = mvp[3] * cx + mvp[7] * cy + mvp[15]; const sx = (mvp[0] * cx + mvp[4] * cy + mvp[12]) / w, sy = (mvp[1] * cx + mvp[5] * cy + mvp[13]) / w; x0 = Math.min(x0, (sx * .5 + .5) * W); x1 = Math.max(x1, (sx * .5 + .5) * W); y0 = Math.min(y0, (1 - (sy * .5 + .5)) * Hh); y1 = Math.max(y1, (1 - (sy * .5 + .5)) * Hh); }
        proj[pl.i] = [x0, y0, x1, y1];
        const isHover = pointer && pointer[0] > x0 && pointer[0] < x1 && pointer[1] > y0 && pointer[1] < y1 && d > 1.2 && d < 7; if (isHover) hover = pl.i;
        const fade = clamp((d - .6) / 1.4) * clamp(1 - (d - 7) / 8);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pl.tex);
        gl.uniformMatrix4fv(Q.u.uMVP, false, mvp); gl.uniform1f(Q.u.uA, fade); gl.uniform1f(Q.u.uSeed, pl.seed);
        gl.uniform1f(Q.u.uG, gl_ * (.5 + .5 * clamp(1 - Math.abs(f - pl.i)))); gl.uniform1f(Q.u.uHover, isHover ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      stage.style.cursor = hover >= 0 ? 'pointer' : '';
      setActive(near);
      hud.style.setProperty('--g', gl_.toFixed(3));
    };
    const start = () => { if (running) return; running = true; resize(); requestAnimationFrame(draw); };
    const stop = () => { running = false; };
    new IntersectionObserver((es) => { es[0].isIntersecting ? start() : stop(); }, { rootMargin: '10%' }).observe(stage);
    track(el.querySelector('.ft__track'), (r) => {
      const raw = trackProgress(r, stage.offsetHeight), x = clamp(raw / .16);
      stage.style.setProperty('--e', (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2).toFixed(4));   // Karte → Vollbild
      prog0 = clamp((raw - .14) / .86);
    });
    return el;
  },
};
