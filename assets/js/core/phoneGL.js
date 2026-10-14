// Kleiner WebGL2-Renderer für ein echtes 3D-Smartphone (ohne Bibliothek).
// Geometrie: abgerundetes Titan-Gehäuse mit Kantenradius, Glas vorn/hinten, Kameramodul mit Linsen, Seitentasten.
// Licht: Studio-Umgebung (Softboxen) wird analytisch im Shader gespiegelt, deshalb wandern die Reflexe beim Drehen.

export const PHONE_W = 1, PHONE_H = 19.5 / 9, PHONE_T = .118;
const TAU = Math.PI * 2;

/* ---------- Matrizen ---------- */
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
const trans = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
const scl = (s) => { const m = ident(); m[0] = m[5] = m[10] = s; return m; };
const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };

/* ---------- Geometrie ---------- */
// Umriss eines abgerundeten Rechtecks (Mittelpunkt cx,cy). Liefert Punkte + Richtung (cos,sin) der Normalen.
function outline(w, h, r, cx = 0, cy = 0, seg = 18) {
  r = Math.min(r, w / 2, h / 2); const pts = [], hx = w / 2 - r, hy = h / 2 - r;
  const corners = [[hx, hy, 0], [-hx, hy, Math.PI / 2], [-hx, -hy, Math.PI], [hx, -hy, Math.PI * 1.5]];
  for (const [ox, oy, a0] of corners) for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; pts.push({ cx: cx + ox, cy: cy + oy, c: Math.cos(a), s: Math.sin(a), r }); }
  return pts;
}
const pushGeo = () => ({ pos: [], nor: [], uv: [], idx: [] });
// Seitenfläche mit abgerundeten Vorder- und Rückkanten
function slab(g, { w, h, r, rr, z0, z1, cx = 0, cy = 0, seg = 18, na = 7 }) {
  rr = Math.min(rr, r - .0001, (z1 - z0) / 2); const ol = outline(w, h, r, cx, cy, seg), prof = [];
  for (let i = 0; i <= na; i++) { const f = i / na * Math.PI / 2; prof.push({ ins: rr - rr * Math.sin(f), z: z1 - rr + rr * Math.cos(f), nr: Math.sin(f), nz: Math.cos(f) }); }
  for (let i = 0; i <= na; i++) { const f = (1 - i / na) * Math.PI / 2; prof.push({ ins: rr - rr * Math.sin(f), z: z0 + rr - rr * Math.cos(f), nr: Math.sin(f), nz: -Math.cos(f) }); }
  const base = g.pos.length / 3, P = prof.length;
  for (const o of ol) for (const q of prof) { const rad = o.r - q.ins; g.pos.push(o.cx + rad * o.c, o.cy + rad * o.s, q.z); g.nor.push(o.c * q.nr, o.s * q.nr, q.nz); g.uv.push(0, 0); }
  for (let j = 0; j < ol.length; j++) { const j2 = (j + 1) % ol.length; for (let i = 0; i < P - 1; i++) { const a = base + j * P + i, b = base + j2 * P + i, c = base + j2 * P + i + 1, d = base + j * P + i + 1; g.idx.push(a, b, c, a, c, d); } }
}
// Flache Fläche (Fächer) auf Höhe z, nach innen versetzt um ins
function cap(g, { w, h, r, ins, z, nz, cx = 0, cy = 0, seg = 18, uvw = w, uvh = h }) {
  const ol = outline(w, h, r, cx, cy, seg), base = g.pos.length / 3;
  g.pos.push(cx, cy, z); g.nor.push(0, 0, nz); g.uv.push(.5, .5);
  for (const o of ol) { const rad = Math.max(.0001, o.r - ins), x = o.cx + rad * o.c, y = o.cy + rad * o.s; g.pos.push(x, y, z); g.nor.push(0, 0, nz); g.uv.push((x - cx) / uvw + .5, .5 - (y - cy) / uvh); }
  for (let j = 0; j < ol.length; j++) g.idx.push(base, base + 1 + j, base + 1 + (j + 1) % ol.length);
}
// Ring zwischen zwei Einrückungen
function ring(g, { w, h, r, ins0, ins1, z, nz, seg = 18 }) {
  const ol = outline(w, h, r, 0, 0, seg), base = g.pos.length / 3;
  for (const o of ol) for (const ins of [ins0, ins1]) { const rad = Math.max(.0001, o.r - ins); g.pos.push(o.cx + rad * o.c, o.cy + rad * o.s, z); g.nor.push(0, 0, nz); g.uv.push(0, 0); }
  for (let j = 0; j < ol.length; j++) { const j2 = (j + 1) % ol.length, a = base + j * 2, b = base + j2 * 2; g.idx.push(a, b, b + 1, a, b + 1, a + 1); }
}
const swapXZ = (g) => { for (const arr of [g.pos, g.nor]) for (let i = 0; i < arr.length; i += 3) { const t = arr[i]; arr[i] = arr[i + 2]; arr[i + 2] = t; } };

/* ---------- Shader ---------- */
const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv;
uniform mat4 uMVP, uModel; uniform mat3 uNrm;
out vec3 vW, vN, vP; out vec2 vUv;
void main(){ vP=aPos; vUv=aUv; vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vN=normalize(uNrm*aNor); gl_Position=uMVP*vec4(aPos,1.); }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW, vN, vP; in vec2 vUv; out vec4 o;
uniform vec3 uEye, uTint; uniform int uMat; uniform float uTime, uIntro, uMix, uLight;
uniform sampler2D uT0, uT1; uniform vec2 uA0, uA1; // Seitenverhältnis der Bilder (Breite/Höhe) in x
uniform vec2 uScr; uniform float uScrR; uniform vec2 uHalf;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float box(vec3 d, vec3 c, vec3 up, float wx, float wy, float soft){ // Softbox: Rechteck in Richtung c
  vec3 r=normalize(cross(up,c)); vec3 u=cross(c,r); float k=dot(d,c); if(k<=0.) return 0.;
  vec2 q=vec2(dot(d,r),dot(d,u))/k; vec2 e=abs(q)-vec2(wx,wy); float s=max(e.x,e.y);
  return 1.-smoothstep(-soft,soft,s); }
vec3 env(vec3 d, float rough){
  float y=d.y*.5+.5; float soft=.02+rough*.9;
  vec3 c=mix(vec3(.012,.013,.017),vec3(.075,.08,.1),y);
  c+=vec3(1.5,1.5,1.6)*box(d,normalize(vec3(.0,1.,.25)),vec3(0,0,1),.9,.55,soft)*uLight;       // große Softbox oben
  c+=vec3(2.0,1.95,1.9)*box(d,normalize(vec3(-1.,.25,.7)),vec3(0,1,0),.28,1.1,soft)*uLight;      // Streifenlicht links
  c+=vec3(.8,1.0,1.5)*box(d,normalize(vec3(1.,.05,.5)),vec3(0,1,0),.2,1.2,soft)*uLight;        // kühles Randlicht rechts
  c+=vec3(.45,.32,.24)*box(d,normalize(vec3(.1,-1.,.6)),vec3(0,0,1),.8,.4,soft)*uLight;           // warmer Boden
  c+=vec3(.6)*box(d,vec3(0,0,1),vec3(0,1,0),.9,1.4,.4+soft)*.35*uLight;                        // Front-Aufheller
  return c; }
float sdRR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
vec3 cover(sampler2D t, vec2 uv, float asp, float boxAsp){ // object-fit: cover
  vec2 s=vec2(1.); if(asp>boxAsp) s.x=boxAsp/asp; else s.y=asp/boxAsp; vec2 u=(uv-.5)*s+.5; return pow(texture(t,u).rgb,vec3(2.2)); }
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uEye-vW); if(!gl_FrontFacing) N=-N; float nv=clamp(dot(N,V),0.,1.); vec3 R=reflect(-V,N);
  float fr=pow(1.-nv,5.); vec3 col;
  if(uMat==0){ // gebürstetes Titan
    float st=hash(vec2(floor((vP.x+vP.z*1.3)*1100.),3.)); float st2=hash(vec2(floor((vP.x*.7+vP.z)*400.),9.)); float n=st*.65+st2*.35; float rough=.3+n*.16;
    vec3 F=uTint+(1.-uTint)*fr*.3; col=F*env(R,rough)*(.78+n*.5)+uTint*.015; }
  else if(uMat==1){ // Frontglas + Bildschirm
    vec2 p=vP.xy; float d=sdRR(p,uScr,uScrR); vec3 base=vec3(.004);
    if(d<0.){ float asp=uScr.x/uScr.y; vec2 uv=vec2(p.x/(uScr.x*2.)+.5,.5-p.y/(uScr.y*2.)); vec3 a=cover(uT0,uv,uA0.x,asp), b=cover(uT1,uv,uA1.x,asp); base=mix(a,b,uMix)*uIntro*.95; }
    // Dynamic Island + Selfie-Kamera
    float isl=sdRR(p-vec2(0.,uHalf.y-.075),vec2(.135,.036),.036); if(isl<.0) base=vec3(0.);
    float lens=length(p-vec2(.095,uHalf.y-.075)); if(lens<.021){ base=mix(vec3(.01,.012,.03),vec3(.05,.09,.22),smoothstep(.02,.004,lens)); }
    float edge=smoothstep(.0,-.012,d)*.0; col=base+env(R,.04)*(.05+.95*fr)*.55+vec3(.02,.025,.04)*pow(1.-nv,3.); }
  else if(uMat==2){ // Rückglas, matt
    float n=hash(floor(vP.xy*1100.)); float e=env(R,.75).r; col=uTint*(.06+.16*e)+env(R,.3)*(.01+.25*fr)*.5+n*.004; }
  else if(uMat==3){ // Kameraplateau (Glas, mattiert)
    float e=env(R,.5).r; col=uTint*(.1+.18*e)+env(R,.2)*(.02+.3*fr)*.5; }
  else if(uMat==4){ // Linsenglas
    vec3 irid=.5+.5*cos(6.2831*(nv*.5+vP.x*3.)+vec3(0.,2.1,4.2)); col=vec3(.002,.003,.007)+env(R,.03)*(.03+.5*fr)*.5+irid*vec3(.03,.05,.14)*pow(1.-nv,1.8); }
  else { // Blitz / LiDAR
    col=vec3(.6,.55,.4)*env(R,.2)*.3+vec3(.03); }
  col=col/(1.+col*.18); // weiches Tone-Mapping
  col=pow(col,vec3(1./2.2)); o=vec4(col,1.); }`;

/* ---------- Renderer ---------- */
export function createPhone(canvas, { tint = [.32, .32, .34], back = [.2, .2, .22], onLost } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const U = {}; for (const n of ['uMVP', 'uModel', 'uNrm', 'uEye', 'uTint', 'uMat', 'uTime', 'uIntro', 'uMix', 'uLight', 'uT0', 'uT1', 'uA0', 'uA1', 'uScr', 'uScrR', 'uHalf']) U[n] = gl.getUniformLocation(pr, n);
  const W = PHONE_W, H = PHONE_H, T = PHONE_T, R = .155 * W, RR = .034;
  const FW = .012, BZ = .022, SCRI = RR + FW + BZ; // Gehäuserand, Glasrand
  // Teile bauen
  const parts = [];
  const mk = (mat, build, tintOverride) => { const g = pushGeo(); build(g); parts.push({ mat, g, tint: tintOverride }); };
  mk(0, (g) => { slab(g, { w: W, h: H, r: R, rr: RR, z0: -T / 2, z1: T / 2 }); ring(g, { w: W, h: H, r: R, ins0: RR - .001, ins1: RR + FW, z: T / 2, nz: 1 }); ring(g, { w: W, h: H, r: R, ins0: RR - .001, ins1: RR + FW, z: -T / 2, nz: -1 }); });
  mk(1, (g) => cap(g, { w: W, h: H, r: R, ins: RR + FW - .0005, z: T / 2 - .002, nz: 1 }));
  mk(2, (g) => cap(g, { w: W, h: H, r: R, ins: RR + FW - .0005, z: -T / 2 + .002, nz: -1 }), back);
  // Kameraplateau (von hinten gesehen oben links = Welt +x)
  const PS = .47, pcx = W / 2 - .045 - PS / 2, pcy = H / 2 - .045 - PS / 2, pz = -T / 2, ph = .024;
  mk(0, (g) => slab(g, { w: PS, h: PS, r: .115, rr: .01, z0: pz - ph, z1: pz + .002, cx: pcx, cy: pcy }));
  mk(3, (g) => cap(g, { w: PS, h: PS, r: .115, ins: .0085, z: pz - ph, nz: -1, cx: pcx, cy: pcy }), back);
  const LR = .095, lz = pz - ph;
  const lenses = [[-.1, .1], [-.1, -.1], [.1, 0]].map(([vx, vy]) => [pcx - vx * .96, pcy + vy * .96]);
  for (const [lx, ly] of lenses) {
    mk(0, (g) => { slab(g, { w: LR * 2, h: LR * 2, r: LR, rr: .008, z0: lz - .016, z1: lz + .002, cx: lx, cy: ly, seg: 10 }); });
    mk(4, (g) => { cap(g, { w: LR * 1.62, h: LR * 1.62, r: LR * .81, ins: 0, z: lz - .0155, nz: -1, cx: lx, cy: ly, seg: 10 }); });
  }
  mk(5, (g) => cap(g, { w: .052, h: .052, r: .026, ins: 0, z: lz - .002, nz: -1, cx: pcx - .17, cy: pcy + .17 }));
  mk(5, (g) => cap(g, { w: .052, h: .052, r: .026, ins: 0, z: lz - .002, nz: -1, cx: pcx - .17, cy: pcy - .17 }));
  // Seitentasten (aus Seitenansicht gebaut und gedreht)
  const btn = (x, y, len, out) => mk(0, (g) => { slab(g, { w: .062, h: len, r: .018, rr: .008, z0: Math.min(x, x + out), z1: Math.max(x, x + out), cx: 0, cy: y, seg: 8, na: 4 }); swapXZ(g); });
  btn(-W / 2 + .004, H * .295, .075, -.014); btn(-W / 2 + .004, H * .20, .17, -.014); btn(-W / 2 + .004, H * .095, .17, -.014); btn(W / 2 - .004, H * .22, .26, .014);
  // GPU-Puffer
  const loc = { aPos: gl.getAttribLocation(pr, 'aPos'), aNor: gl.getAttribLocation(pr, 'aNor'), aUv: gl.getAttribLocation(pr, 'aUv') };
  const vao = (g) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); const buf = (arr, l, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }; buf(g.pos, loc.aPos, 3); buf(g.nor, loc.aNor, 3); buf(g.uv, loc.aUv, 2); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW); return v; };
  for (const p of parts) { p.vao = vao(p.g); p.n = p.g.idx.length; }
  // Texturen
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8); return t; };
  const slots = [{ t: tex(), a: 1, el: null, vid: false }, { t: tex(), a: 1, el: null, vid: false }];
  const upload = (s, el) => { const w = el.naturalWidth || el.videoWidth || el.width, h = el.naturalHeight || el.videoHeight || el.height; if (!w || !h) return false; gl.bindTexture(gl.TEXTURE_2D, s.t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); } catch (e) { return false; } if (s.vid) { if (!s.lin) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); s.lin = true; } } else { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); s.lin = false; } s.a = w / h; return true; };
  const setSlot = (i, el) => { const s = slots[i]; s.el = el; s.vid = el instanceof HTMLVideoElement; s.ready = false; const go = () => { s.ready = upload(s, el); }; if (s.vid) { el.addEventListener('loadeddata', go, { once: true }); if (el.readyState >= 2) go(); } else if (el.complete && el.naturalWidth) go(); else el.addEventListener('load', go, { once: true }); };
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clearColor(0, 0, 0, 0);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });
  const api = {
    setSlot, ready: (i) => !!slots[i].ready,
    // st: {rx,ry,rz (Grad), y, scale, mix, intro, time, light, w, h, dpr, fit(0..1)}
    draw(st) {
      const cw = canvas.width, ch = canvas.height; gl.viewport(0, 0, cw, ch); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const fov = 26 * Math.PI / 180, asp = cw / ch, tn = Math.tan(fov / 2);
      const land = Math.abs(Math.sin((st.rz || 0) * Math.PI / 180)) > .7; const ext = land ? [H, W] : [W, H]; // Ausdehnung auf dem Schirm
      const dist = Math.max(ext[1] / (2 * tn * st.fit), ext[0] / (2 * tn * asp * st.fit)) + .6;
      const proj = persp(fov, asp, .5, 20), view = trans(0, 0, -dist);
      const model = mul(trans(0, st.y || 0, 0), mul(rotX((st.rx || 0) * Math.PI / 180), mul(rotY((st.ry || 0) * Math.PI / 180), rotZ((st.rz || 0) * Math.PI / 180))));
      const mvp = mul(proj, mul(view, model));
      gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniformMatrix4fv(U.uModel, false, model);
      gl.uniformMatrix3fv(U.uNrm, false, new Float32Array([model[0], model[1], model[2], model[4], model[5], model[6], model[8], model[9], model[10]]));
      gl.uniform3f(U.uEye, 0, 0, dist); gl.uniform1f(U.uTime, st.time || 0); gl.uniform1f(U.uIntro, st.intro == null ? 1 : st.intro); gl.uniform1f(U.uMix, st.mix || 0); gl.uniform1f(U.uLight, st.light == null ? 1 : st.light);
      for (let i = 0; i < 2; i++) { const s = slots[i]; if (s.vid && s.ready && s.el.readyState >= 2) upload(s, s.el); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, s.t); }
      gl.uniform1i(U.uT0, 0); gl.uniform1i(U.uT1, 1); gl.uniform2f(U.uA0, slots[0].a, 0); gl.uniform2f(U.uA1, slots[1].a, 0);
      gl.uniform2f(U.uScr, W / 2 - SCRI, H / 2 - SCRI); gl.uniform1f(U.uScrR, R - SCRI); gl.uniform2f(U.uHalf, W / 2 - SCRI, H / 2 - SCRI);
      for (const p of parts) { gl.uniform1i(U.uMat, p.mat); const c = p.tint || tint; gl.uniform3f(U.uTint, c[0], c[1], c[2]); gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.n, gl.UNSIGNED_INT, 0); }
    },
  };
  return api;
}

// Gemeinsame Bausteine für weitere 3D-Geräte (Laptop)
export { slab, cap, ring, pushGeo, mul, ident, rotX, rotY, rotZ, trans, persp };
