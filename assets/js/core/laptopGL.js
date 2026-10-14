// WebGL2-Renderer für einen echten 3D-Laptop (ohne Bibliothek): Alu-Gehäuse mit Fase, Scharnier, aufklappbarer Deckel mit Glas-Display,
// Tastatur mit einzelnen Tasten, Trackpad, Lautsprecher-Gitter. Studio-Licht wird im Shader gespiegelt (Reflexe wandern beim Drehen/Öffnen).
import { slab, cap, ring, pushGeo, mul, rotX, rotY, trans, persp } from './phoneGL.js';

const LW = 1, LH = .70, LT = .0125, DD = .71, DT = .021, HY = DT / 2 + .0047, HZ = -DD / 2 + .008; // Deckel-Breite/-Höhe/-Dicke, Basis-Tiefe/-Dicke, Scharnier
const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv;
uniform mat4 uMVP, uModel; uniform mat3 uNrm;
out vec3 vW, vN, vP; out vec2 vUv;
void main(){ vP=aPos; vUv=aUv; vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vN=normalize(uNrm*aNor); gl_Position=uMVP*vec4(aPos,1.); }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW, vN, vP; in vec2 vUv; out vec4 o;
uniform vec3 uEye, uTint; uniform int uMat; uniform float uTime, uIntro, uMix, uLight, uScroll, uChrome, uOpen;
uniform mat3 uNrm; uniform sampler2D uT0, uT1, uTL, uTK; uniform float uLogo; uniform vec2 uA; uniform vec2 uScr; uniform float uScrR;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float box(vec3 d, vec3 c, vec3 up, float wx, float wy, float soft){
  vec3 r=normalize(cross(up,c)); vec3 u=cross(c,r); float k=dot(d,c); if(k<=0.) return 0.;
  vec2 q=vec2(dot(d,r),dot(d,u))/k; vec2 e=abs(q)-vec2(wx,wy); float s=max(e.x,e.y);
  return 1.-smoothstep(-soft,soft,s); }
vec3 env(vec3 d, float rough){
  float y=d.y*.5+.5; float soft=.02+rough*.9;
  vec3 c=mix(vec3(.02,.022,.028),vec3(.11,.12,.15),y);
  c+=vec3(1.7,1.7,1.8)*box(d,normalize(vec3(.0,1.,.2)),vec3(0,0,1),1.0,.7,soft)*uLight;
  c+=vec3(2.2,2.1,2.0)*box(d,normalize(vec3(-1.,.3,.6)),vec3(0,1,0),.3,1.2,soft)*uLight;
  c+=vec3(.9,1.1,1.6)*box(d,normalize(vec3(1.,.1,.4)),vec3(0,1,0),.22,1.2,soft)*uLight;
  c+=vec3(.5,.4,.32)*box(d,normalize(vec3(.1,-1.,.5)),vec3(0,0,1),.9,.5,soft)*uLight;
  c+=vec3(.7)*box(d,vec3(0,0,1),vec3(0,1,0),1.0,1.4,.4+soft)*.4*uLight;
  return c; }
float lh(vec2 uv){ vec4 t=texture(uTL,uv); return t.a*(1.-min(t.r,min(t.g,t.b))*.8); }
float sdRR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
vec3 cover(sampler2D t, vec2 uv, float asp, float boxAsp){
  vec2 s=vec2(1.); vec2 u;
  if(asp>boxAsp){ s.x=boxAsp/asp; u=(uv-.5)*s+.5; } else { s.y=asp/boxAsp; u=vec2(uv.x, uv.y*s.y+uScroll*(1.-s.y)); }
  return pow(texture(t,u).rgb,vec3(2.2)); }
vec3 alum(vec3 R, float nv, vec3 pp, vec3 N){
  float fr=pow(1.-nv,5.); float n=hash(floor(pp.xy*1500.)); float rough=.3+n*.04;
  vec3 F=uTint+(1.-uTint)*fr*.4; return F*min(env(R,rough),vec3(.85))*(.86+n*.1)+uTint*mix(.16,.62,N.y*.5+.5)*(.94+n*.08); }
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uEye-vW); if(!gl_FrontFacing) N=-N; float nv=clamp(dot(N,V),0.,1.); vec3 R=reflect(-V,N);
  float fr=pow(1.-nv,5.); vec3 col;
  if(uMat==8){ float a=texture(uTK,vUv).a; vec3 c=vec3(.8,.82,.86)*(.55+.45*env(R,.5).r*.5); c=c/(1.+c*.34); c=pow(c,vec3(1./2.2)); o=vec4(c*a,a); return; }
  if(uMat==0){ col=alum(R,nv,vP,N); }
  else if(uMat==1){ // Display-Glas
    vec2 p=vP.xy; float d=sdRR(p,uScr,uScrR); vec3 base=vec3(.003);
    if(d<0.){
      float bar=uChrome*.05; float top=uScr.y; vec3 c;
      if(p.y>top-bar){ c=vec3(.93,.93,.94); vec2 q=vec2(p.x+uScr.x-.028, p.y-(top-bar*.5)); for(int i=0;i<3;i++){ float dd=length(q-vec2(float(i)*.0165,0.)); vec3 dc=i==0?vec3(1.,.37,.34):i==1?vec3(1.,.74,.18):vec3(.16,.78,.25); c=mix(c,dc,1.-smoothstep(.005,.0065,dd)); }
        float pill=sdRR(p-vec2(.02,top-bar*.5),vec2(uScr.x*.62,bar*.3),bar*.3); c=mix(c,vec3(1.),1.-smoothstep(-.001,.001,pill)); }
      else { float hh=top*2.-bar; vec2 uv=vec2(p.x/(uScr.x*2.)+.5,(top-bar-p.y)/hh); float asp=uScr.x*2./hh; vec3 a=cover(uT0,uv,uA.x,asp), b=cover(uT1,uv,uA.y,asp); c=mix(a,b,uMix); }
      base=c*uIntro*.96; }
    float notch=sdRR(p-vec2(0.,uScr.y),vec2(.06,.027),.0095); base=mix(base,vec3(0.),1.-smoothstep(-.0006,.0006,notch));
    float lens=length(p-vec2(0.,uScr.y-.0125)); if(lens<.0042) base=mix(vec3(.012,.014,.03),vec3(.05,.09,.22),smoothstep(.0042,.0012,lens));
    col=base+env(R,.05)*(.04+.9*fr)*.5+vec3(.02,.025,.04)*pow(1.-nv,3.); }
  else if(uMat==2){ // Deckel-Rückseite + Spiegel-Logo
    col=alum(R,nv,vP,N);
    if(uLogo>.5){ vec2 q=vP.xy/.15; q.x=-q.x; q+=.5;
      if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){ vec2 uv=vec2(q.x,1.-q.y); vec2 e=vec2(2.2/512.); vec4 lg=texture(uTL,uv);
        float hxp=lh(uv+vec2(e.x,0.)), hxm=lh(uv-vec2(e.x,0.)), hyp=lh(uv+vec2(0.,e.y)), hym=lh(uv-vec2(0.,e.y));
        float gx=(hxp-hxm), gy=(hyp-hym);
        vec3 Tx=normalize(uNrm[0]), Ty=normalize(uNrm[1]); vec3 N2=normalize(N+(-Tx*gx+Ty*gy)*1.4); vec3 R2=reflect(-V,N2);
        vec3 pol=(vec3(.42)+uTint*.6)*min(env(R2,.08),vec3(1.5))*1.05+uTint*.07;
        float m=clamp(lg.a*1.2,0.,1.); col=mix(col,pol*(1.-.16*lh(uv)),m); col*=1.-.1*clamp(abs(gx)+abs(gy),0.,1.); } }
  }
  else if(uMat==3){ col=vec3(.016)+env(R,.4)*(.015+.25*fr)*.6; }
  else if(uMat==4){ float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); float line=smoothstep(.0,.006,e); col=alum(R,nv,vP,N)*(.72+.28*line)+min(env(R,.06),vec3(.7))*.06*line; }
  else if(uMat==5){ col=vec3(.004)+env(R,.7)*.008; }
  else if(uMat==6){ col=env(R,.35)*vec3(.09)+vec3(.012); }
  else { vec2 g=fract(vP.xy*190.)-.5; float dt=smoothstep(.34,.25,length(g)); col=mix(alum(R,nv,vP,N),vec3(.012),dt); }
  col=col/(1.+col*.34); col=pow(col,vec3(1./2.2)); o=vec4(col,1.); }`;

function cylinder(g, len, r, seg = 20) {
  const b = g.pos.length / 3;
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); for (const x of [-len / 2, len / 2]) { g.pos.push(x, r * c, r * s); g.nor.push(0, c, s); g.uv.push(0, 0); } }
  for (let i = 0; i < seg; i++) { const a = b + i * 2; g.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
}

export function createLaptop(canvas, { tint: tint0 = [.74, .75, .78], onLost } = {}) {
  let tint = tint0;
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const U = {}; for (const n of ['uMVP', 'uModel', 'uNrm', 'uEye', 'uTint', 'uMat', 'uTime', 'uIntro', 'uMix', 'uLight', 'uScroll', 'uChrome', 'uOpen', 'uT0', 'uT1', 'uTL', 'uTK', 'uLogo', 'uA', 'uScr', 'uScrR']) U[n] = gl.getUniformLocation(pr, n);
  const parts = []; // grp: 0 = Basis (liegt), 1 = Deckel (klappt), 2 = Scharnier
  const mk = (grp, mat, build, tn) => { const g = pushGeo(); build(g); parts.push({ grp, mat, g, tint: tn }); };
  const R = .026, RR = .0085, FW = .0028;
  // Basis (lokal: XY = Draufsicht, Z = Dicke; wird später auf den Boden gelegt)
  mk(0, 0, (g) => { slab(g, { w: LW, h: DD, r: R, rr: RR, z0: -DT / 2, z1: DT / 2, seg: 10, na: 6 }); cap(g, { w: LW, h: DD, r: R, ins: RR - .0006, z: DT / 2, nz: 1, seg: 10 }); cap(g, { w: LW, h: DD, r: R, ins: RR - .0006, z: -DT / 2, nz: -1, seg: 10 }); });
  // MacBook-Tastatur (US-Layout): Funktionsreihe halbhoch, Pfeiltasten als umgekehrtes T, Touch-ID-Taste, Lautsprecher-Gitter links/rechts
  const L5 = (t) => t.split(' ');
  const row = (ks) => ks.map((k) => (Array.isArray(k) ? k : [k, 1]));
  const KR = [
    [.62, [['esc', 1.5], ...L5('F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12').map(k => [k, 1]), ['', 1, 'id']]],
    [1, [...L5('^ 1 2 3 4 5 6 7 8 9 0 ß ´').map(k => [k, 1]), ['delete', 1.5]]],
    [1, [['tab', 1.5], ...L5('Q W E R T Z U I O P Ü +').map(k => [k, 1]), ['#', 1]]],
    [1, [['caps lock', 1.75], ...L5('A S D F G H J K L Ö Ä').map(k => [k, 1]), ['return', 1.75]]],
    [1, [['shift', 1.25], ['<', 1], ...L5('Y X C V B N M , . -').map(k => [k, 1]), ['shift', 2.25]]],
    [1, [['fn', 1], ['control', 1], ['option', 1], ['command', 1.25], ['', 5], ['command', 1.25], ['option', 1], ['◀', 1, 'arrow'], ['', 1, 'ud'], ['▶', 1, 'arrow']]],
  ];
  const kbW = .86, gap = .0052, uW = (kbW - gap * 15) / 14.5, kh = uW * .98;
  const kbH = KR.reduce((a, [hs]) => a + hs * kh, 0) + gap * (KR.length + 1), kbY = DD / 2 - .07 - kbH / 2, zt = DT / 2;
  const keys = []; // {x,y,w,h,label,kind}
  { let y = kbY + kbH / 2 - gap; KR.forEach(([hs, ks]) => { const hh = hs * kh; y -= hh / 2; let x = -kbW / 2 + gap; ks.forEach(([lab, w, kind]) => { const kw = w * uW + (w - 1) * gap * (w > 1 ? 1 : 0); if (kind === 'ud') { keys.push({ x: x + kw / 2, y: y + hh / 4 + gap / 4, w: kw, h: hh / 2 - gap / 2, label: '▲', kind: 'arrow' }, { x: x + kw / 2, y: y - hh / 4 - gap / 4, w: kw, h: hh / 2 - gap / 2, label: '▼', kind: 'arrow' }); } else keys.push({ x: x + kw / 2, y, w: kw, h: hh, label: lab, kind }); x += kw + gap; }); y -= hh / 2 + gap; }); }
  mk(0, 5, (g) => cap(g, { w: kbW + .014, h: kbH + .014, r: .007, ins: 0, z: zt + .0003, nz: 1, cy: kbY, seg: 6 }));
  mk(0, 7, (g) => { for (const sx of [-1, 1]) cap(g, { w: .034, h: kbH, r: .004, ins: 0, z: zt + .0004, nz: 1, cx: sx * (kbW / 2 + .036), cy: kbY, seg: 4 }); });
  mk(0, 4, (g) => cap(g, { w: .44, h: .27, r: .012, ins: 0, z: zt + .0003, nz: 1, cy: -DD / 2 + .04 + .135, seg: 8, uvw: .44, uvh: .27 }));
  mk(0, 3, (g) => { for (const k of keys) slab(g, { w: k.w, h: k.h, r: .0055, rr: .0022, z0: zt, z1: zt + .0030, cx: k.x, cy: k.y, seg: 3, na: 2 }); });
  // Beschriftung der Tasten als Textur (Alpha), liegt als dünne Fläche über den Tasten
  const legendTex = (() => { const TW = 2048, TH = Math.round(TW * kbH / kbW), c = document.createElement('canvas'); c.width = TW; c.height = TH; const x = c.getContext('2d'); const sx = TW / kbW, sy = TH / kbH;
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const k of keys) { const cx = (k.x + kbW / 2) * sx, cy = (kbY + kbH / 2 - k.y) * sy, kh2 = k.h * sy, kw2 = k.w * sx; const lab = k.label;
      if (k.kind === 'id') { x.strokeStyle = '#fff'; x.lineWidth = kh2 * .06; x.beginPath(); x.arc(cx, cy, kh2 * .26, 0, 7); x.stroke(); continue; }
      if (!lab) continue; const small = lab.length > 1 && k.kind !== 'arrow'; const fsz = small ? kh2 * .2 : k.kind === 'arrow' ? kh2 * .28 : kh2 * .42;
      x.font = `${small ? 500 : 400} ${fsz}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
      if (small && /^(tab|caps lock|shift|delete|return|control|option|command|fn|esc)$/.test(lab)) { const left = /^(tab|caps lock|shift|control|option|command|esc)$/.test(lab); x.textAlign = left ? 'left' : 'right'; x.textBaseline = 'bottom'; x.fillText(lab, cx + (left ? -kw2 / 2 + kh2 * .13 : kw2 / 2 - kh2 * .13), cy + kh2 / 2 - kh2 * .12); x.textAlign = 'center'; x.textBaseline = 'middle'; }
      else x.fillText(lab, cx, cy + (small ? 0 : kh2 * .02)); }
    return c; })();
  mk(0, 8, (g) => cap(g, { w: kbW, h: kbH, r: .002, ins: 0, z: zt + .0034, nz: 1, cy: kbY, seg: 3, uvw: kbW, uvh: kbH }));
  // Scharnier
  mk(2, 5, (g) => cylinder(g, LW * .9, .0052));
  // Deckel (lokal um die Mitte; Vorderseite = +Z)
  mk(1, 0, (g) => { slab(g, { w: LW, h: LH, r: R, rr: RR * .75, z0: -LT, z1: 0, seg: 10, na: 6 }); ring(g, { w: LW, h: LH, r: R, ins0: RR * .75 - .001, ins1: RR * .75 + FW, z: 0, nz: 1, seg: 10 }); ring(g, { w: LW, h: LH, r: R, ins0: RR * .75 - .001, ins1: RR * .75 + FW, z: -LT, nz: -1, seg: 10 }); });
  mk(1, 1, (g) => cap(g, { w: LW, h: LH, r: R, ins: RR * .75 + FW - .0006, z: -.0006, nz: 1, seg: 10 }));
  mk(1, 2, (g) => cap(g, { w: LW, h: LH, r: R, ins: RR * .75 + FW - .0006, z: -LT + .0006, nz: -1, seg: 10 }));
  const loc = { aPos: gl.getAttribLocation(pr, 'aPos'), aNor: gl.getAttribLocation(pr, 'aNor'), aUv: gl.getAttribLocation(pr, 'aUv') };
  const vao = (g) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); const buf = (arr, l, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }; buf(g.pos, loc.aPos, 3); buf(g.nor, loc.aNor, 3); buf(g.uv, loc.aUv, 2); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW); return v; };
  for (const p of parts) { p.vao = vao(p.g); p.n = p.g.idx.length; }
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8); return t; };
  const slots = [{ t: tex(), a: 1 }, { t: tex(), a: 1 }];
  const upload = (s, el) => { const w = el.naturalWidth || el.videoWidth || el.width, h = el.naturalHeight || el.videoHeight || el.height; if (!w || !h) return false; gl.bindTexture(gl.TEXTURE_2D, s.t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); } catch (e) { return false; } if (s.vid) { if (!s.lin) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); s.lin = true; } } else { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); s.lin = false; } s.a = w / h; return true; };
  const setSlot = (i, el) => { const s = slots[i]; s.el = el; s.vid = el instanceof HTMLVideoElement; s.ready = false; if (!el) return; const go = () => { s.ready = upload(s, el); }; if (s.vid) { el.addEventListener('loadeddata', go, { once: true }); if (el.readyState >= 2) go(); } else if (el.complete && el.naturalWidth) go(); else el.addEventListener('load', go, { once: true }); };
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clearColor(0, 0, 0, 0);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });
  const legT = tex(); gl.bindTexture(gl.TEXTURE_2D, legT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, legendTex); gl.generateMipmap(gl.TEXTURE_2D);
  const logoT = tex(); let logoOn = 0;
  const setLogo = (img) => { if (!img) { logoOn = 0; return; } const go = () => { gl.bindTexture(gl.TEXTURE_2D, logoT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); logoOn = 1; } catch (e) { logoOn = 0; } }; if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true }); };
  const SCR = [LW / 2 - .017, LH / 2 - .016];
  return {
    setSlot, setLogo, setTint: (c) => { tint = c; },
    // st: { open 0..1, rx, ry (Grad), y, fit, mix, intro, time, light, scroll 0..1, chrome 0/1 }
    draw(st) {
      const cw = canvas.width, ch = canvas.height; gl.viewport(0, 0, cw, ch); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const fov = 24 * Math.PI / 180, asp = cw / ch, tn = Math.tan(fov / 2), o = st.open;
      const ang = (90 - o * 112) * Math.PI / 180; // 90° = zugeklappt (liegt auf der Basis), -22° = offen, leicht nach hinten geneigt
      const eh = .76 + (.24) * o, ew = 1.08, dist = Math.max(eh / (2 * tn * st.fit), ew / (2 * tn * asp * st.fit)) + .55;
      const cy = .3 * o + .02 * (1 - o);
      const proj = persp(fov, asp, .4, 20), view = trans(0, 0, -dist);
      const world = mul(trans(0, st.y || 0, 0), mul(rotX((st.rx || 0) * Math.PI / 180), mul(rotY((st.ry || 0) * Math.PI / 180), trans(0, -cy, 0))));
      const base = rotX(-Math.PI / 2), lid = mul(trans(0, HY, HZ), mul(rotX(ang), trans(0, LH / 2, 0))), hinge = trans(0, HY, HZ);
      const mats = [base, lid, hinge];
      gl.uniform3f(U.uEye, 0, 0, dist); gl.uniform1f(U.uTime, st.time || 0); gl.uniform1f(U.uIntro, st.intro == null ? 1 : st.intro); gl.uniform1f(U.uMix, st.mix || 0); gl.uniform1f(U.uLight, st.light == null ? 1 : st.light);
      gl.uniform1f(U.uScroll, st.scroll || 0); gl.uniform1f(U.uChrome, st.chrome ? 1 : 0); gl.uniform1f(U.uOpen, o);
      for (let i = 0; i < 2; i++) { const s = slots[i]; if (s.vid && s.ready && s.el.readyState >= 2) upload(s, s.el); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, s.t); }
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, legT); gl.uniform1i(U.uTK, 3); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, logoT); gl.uniform1i(U.uTL, 2); gl.uniform1f(U.uLogo, logoOn); gl.uniform1i(U.uT0, 0); gl.uniform1i(U.uT1, 1); gl.uniform2f(U.uA, slots[0].a, slots[1].a); gl.uniform2f(U.uScr, SCR[0], SCR[1]); gl.uniform1f(U.uScrR, .006);
      for (const p of parts) {
        const model = mul(world, mats[p.grp]), mvp = mul(proj, mul(view, model));
        gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniformMatrix4fv(U.uModel, false, model);
        gl.uniformMatrix3fv(U.uNrm, false, new Float32Array([model[0], model[1], model[2], model[4], model[5], model[6], model[8], model[9], model[10]]));
        gl.uniform1i(U.uMat, p.mat); if (p.mat === 8) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } const c = p.tint || tint; gl.uniform3f(U.uTint, c[0], c[1], c[2]); gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.n, gl.UNSIGNED_INT, 0); if (p.mat === 8) gl.disable(gl.BLEND);
      }
    },
  };
}
