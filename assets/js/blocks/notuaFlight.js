// NOTUA-Flug: 3D-Flug durch Boards der eigenen App (reines WebGL). Die Karten werden live im NOTUA-Look mit Canvas 2D gezeichnet
// und spielen, sobald man bei ihnen ankommt, eine kleine Animation (Text tippen, Bilder einsetzen, Aufgaben abhaken, Boards öffnen …).
// Alle Texte, Bilder und Farben sind im Admin änderbar.
const FONTS = {
  default: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  rounded: '"Nunito", "Varela Round", ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
};
let FONT = FONTS.default;
// Look (wie im Look-Finder der App): Ecken, Schatten, Rahmen, Hintergrund
const LK = { rk: 1, shA: .20, shB: 26, shY: 8, bw: 2, bc: null, bg: 'grid' };
let TH = { bg: '#E7EAEE', dot: '#C6CCD4', surface: '#FFFFFF', surface2: '#F0F2F5', ink: '#1B2027', muted: '#5C6570', faint: '#8A9099', border: '#D7DBE1', accent: '#FF6B57', accentSoft: '#FFE3DD' };
const DEF = {
  notes: 'Script intro\n– Hook in 3 sec\n– Scene 1: workshop\n– Scene 2: interview',
  list: 'Shot list\n1. Wide shot\n2. Close-up\n3. Hands detail\n4. Reverse shot',
  tableTitle: 'Scene overview', table: 'Intro, 0:12, Wide\nWorkshop, 0:28, Close-up\nInterview, 0:45, Medium',
  tasksTitle: 'Tasks', tasks: 'x Review footage\nx Rough cut\nx Color grade\nSound design\nExport in 4K',
  columnsTitle: 'Pipeline', columns: 'Idea: New clip | Moodboard\nDoing: Cut v2 | Grading | Music\nDone: Teaser',
  boardsTitle: 'Boards', boards: 'Shoot 2026 | Clients | Ideas', subBoards: 'Day 1 | Day 2 | B-Roll',
  connect: 'Idea | Script | Shoot | Cut', widgetTitle: 'Embedded video',
  featureText: 'Notes | Capture ideas the second they appear – scripts, shot notes, thoughts. Everything lives on one endless canvas.\nTables | Scene overview, budget, schedule – clear in cells.\nTasks | Tick off what is done, keep the rest in sight.\nWidgets | Pin images, YouTube videos and Spotify playlists right next to your ideas.\nBoards | Boards inside boards – every project gets its own space.\nYour look | Make it yours: colour world, light or dark, corners, shadow, border and font. Then keep the look.',
  wImgText: 'moodboard.jpg', wYtText: 'Behind the scenes', wSpText: 'Late night mix', wSpSub: 'Playlist'
};
const lines = (s) => String(s == null ? '' : s).split('\n').map(x => x.trim()).filter(Boolean);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ez = (x) => 1 - Math.pow(1 - clamp(x), 3);
const seg = (t, a, d) => ez((t - a) / d);

/* ============ Karten zeichnen (Canvas 2D, wie die Karten im NOTUA-Board) ============ */
const CW = 880, CH = 620;
function rr(c, x, y, w, h, r) { r = Math.min(r * LK.rk, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function base(c, x, y, w, h) {
  c.clearRect(0, 0, CW, CH); c.save();
  if (LK.shA > 0) { c.shadowColor = `rgba(24,28,35,${LK.shA})`; c.shadowBlur = LK.shB; c.shadowOffsetY = LK.shY; } c.fillStyle = TH.surface; rr(c, x, y, w, h, 10); c.fill(); c.restore();
  if (LK.bw > 0) { c.strokeStyle = LK.bc || TH.border; c.lineWidth = LK.bw; rr(c, x, y, w, h, 10); c.stroke(); } c.textBaseline = 'middle'; c.textAlign = 'left';
}
const ICO = {
  note: (c, x, y) => { c.save(); c.translate(x, y); c.scale(1.5, 1.5); c.strokeStyle = TH.faint; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(11, 0); c.lineTo(14, 3); c.lineTo(14, 16); c.lineTo(0, 16); c.closePath(); c.moveTo(4, 7); c.lineTo(11, 7); c.moveTo(4, 11); c.lineTo(11, 11); c.stroke(); c.restore(); },
  table: (c, x, y) => { c.strokeStyle = TH.faint; c.lineWidth = 2.4; c.strokeRect(x, y, 26, 24); c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + 26, y + 8); c.moveTo(x, y + 16); c.lineTo(x + 26, y + 16); c.moveTo(x + 9, y); c.lineTo(x + 9, y + 24); c.moveTo(x + 18, y); c.lineTo(x + 18, y + 24); c.stroke(); },
  folder: (c, x, y) => { c.strokeStyle = TH.faint; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + 9, y + 4); c.lineTo(x + 12, y + 8); c.lineTo(x + 28, y + 8); c.lineTo(x + 28, y + 26); c.lineTo(x, y + 26); c.closePath(); c.stroke(); },
};
const txt = (c, t, x, y, size = 42, color = TH.ink, weight = 400) => { c.fillStyle = color; c.font = `${weight} ${size}px ${FONT}`; c.fillText(t, x, y); };
// Text, der Zeichen für Zeichen getippt wird; gibt die Position des Cursors zurück
function typed(c, s, x, y, size, color, weight, n, maxW) {
  let sz = size; c.font = `${weight} ${sz}px ${FONT}`; while (maxW && sz > 18 && c.measureText(s).width > maxW) { sz -= 2; c.font = `${weight} ${sz}px ${FONT}`; }
  const part = s.slice(0, Math.max(0, Math.floor(n))); c.fillStyle = color; c.fillText(part, x, y); return x + c.measureText(part).width;
}
const caret = (c, x, y, h, t) => { if (Math.floor(t * 2.2) % 2 === 0) { c.fillStyle = TH.accent; c.fillRect(x + 3, y - h / 2, 3, h); } };
const cursor = (c, x, y, a = 1) => { c.save(); c.globalAlpha = a; c.translate(x, y); c.fillStyle = TH.ink; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(8, 23); c.lineTo(14, 36); c.lineTo(19, 34); c.lineTo(13, 21); c.lineTo(23, 21); c.closePath(); c.fill(); c.stroke(); c.restore(); };

function dNote(c, t, D, key, icon = true) {
  base(c, 120, 70, 640, 430); if (icon) ICO.note(c, 160, 114);
  const ls = lines(D[key]); const total = ls.reduce((a, l) => a + l.length, 0), per = 22, T = t % (total / per + 3.5);
  let n = Math.max(0, (T - .5) * per), cx = 0, cy = 0;
  ls.forEach((l, i) => { const y = 205 + i * 62, k = clamp(n, 0, l.length); const ex = typed(c, l, 160, y, i ? 44 : 46, i ? TH.ink : TH.ink, i ? 400 : 700, k, 540); if (n > 0 && n <= l.length + 0.01 || (i === ls.length - 1 && n > 0)) { cx = ex; cy = y; } n -= l.length; });
  if (cy) caret(c, cx, cy, 48, t);
}
function dTasks(c, t, D) {
  base(c, 120, 70, 640, 440); ICO.note(c, 160, 114); txt(c, D.tasksTitle, 210, 124, 40, TH.ink, 700);
  const items = lines(D.tasks).slice(0, 6).map(l => ({ done: /^x\s/i.test(l), s: l.replace(/^x\s+/i, '') })); let k = 0; const T = t % (items.length * .8 + 4);
  items.forEach((it, i) => { const y = 200 + i * 62; let p = 0; if (it.done) { p = seg(T, .9 + k * .8, .4); k++; }
    c.lineWidth = 3; c.strokeStyle = p > .05 ? TH.accent : '#B8BFC8'; rr(c, 160, y - 17, 34, 34, 8); if (p > .05) { c.fillStyle = TH.accent; c.globalAlpha = p; c.fill(); c.globalAlpha = 1; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(168, y); c.lineTo(175, y + 8); c.lineTo(187, y - 8); c.stroke(); } else c.stroke();
    let sz = 36; c.font = `400 ${sz}px ${FONT}`; while (sz > 20 && c.measureText(it.s).width > 480) { sz -= 2; c.font = `400 ${sz}px ${FONT}`; }
    c.fillStyle = p > .5 ? TH.faint : TH.ink; c.fillText(it.s, 216, y + 2); if (p) { c.fillStyle = TH.faint; c.fillRect(216, y + 2, c.measureText(it.s).width * p, 3); } });
}
function dTable(c, t, D) {
  base(c, 60, 60, 760, 470); ICO.table(c, 100, 98); txt(c, D.tableTitle, 150, 110, 40, TH.ink, 700);
  const rows = lines(D.table).slice(0, 4).map(r => r.split(',').map(x => x.trim()).slice(0, 4)), nc = Math.max(1, ...rows.map(r => r.length));
  const X = 100, Y = 160, cw0 = 70, rh = 66, cw = 585 / nc, T = t % (rows.length * nc * .32 + 4);
  c.fillStyle = TH.surface2; c.fillRect(X, Y, cw0 + 585, 56); c.textAlign = 'center'; for (let i = 0; i < nc; i++) txt(c, String.fromCharCode(65 + i), X + cw0 + cw * i + cw / 2, Y + 29, 26, TH.muted, 700); c.textAlign = 'left';
  c.strokeStyle = TH.border; c.lineWidth = 2; let q = 0;
  rows.forEach((r, ri) => { const y = Y + 56 + ri * rh; c.fillStyle = TH.surface2; c.fillRect(X, y, cw0, rh); c.strokeRect(X, y, cw0, rh); c.textAlign = 'center'; txt(c, String(ri + 1), X + cw0 / 2, y + rh / 2 + 2, 24, TH.muted, 700); c.textAlign = 'left';
    for (let i = 0; i < nc; i++) { const x = X + cw0 + cw * i, s = r[i] || '', st = .5 + q * .32; q++; c.strokeRect(x, y, cw, rh);
      const n = clamp((T - st) * 18, 0, s.length); if (T > st && T < st + .4) { c.fillStyle = TH.accentSoft; c.fillRect(x + 2, y + 2, cw - 4, rh - 4); c.strokeStyle = TH.accent; c.strokeRect(x + 1, y + 1, cw - 2, rh - 2); c.strokeStyle = TH.border; }
      typed(c, s, x + 16, y + rh / 2 + 2, 28, TH.ink, 400, n, cw - 24); } });
}
function dColumns(c, t, D) {
  base(c, 50, 60, 780, 470); txt(c, D.columnsTitle, 90, 108, 38, TH.ink, 700);
  const cols = lines(D.columns).slice(0, 3).map(l => { const [h, r = ''] = l.split(':'); return [h.trim(), r.split('|').map(x => x.trim()).filter(Boolean).slice(0, 3)]; }); let q = 0; const T = t % 9;
  cols.forEach(([h, cs], i) => { const x = 90 + i * 232; c.fillStyle = TH.surface2; rr(c, x, 150, 212, 340, 8); c.fill(); txt(c, h, x + 16, 178, 26, TH.muted, 700);
    cs.forEach((s, k) => { const p = seg(T, .5 + q * .45, .5); q++; const y = 208 + k * 92 - (1 - p) * 40; c.save(); c.globalAlpha = p; c.fillStyle = TH.surface; c.shadowColor = 'rgba(24,28,35,.14)'; c.shadowBlur = 6; c.shadowOffsetY = 2; rr(c, x + 12, y, 188, 78, 6); c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = TH.border; c.lineWidth = 2; rr(c, x + 12, y, 188, 78, 6); c.stroke();
      let sz = 26; c.font = `400 ${sz}px ${FONT}`; while (sz > 15 && c.measureText(s).width > 160) { sz -= 1; c.font = `400 ${sz}px ${FONT}`; } c.fillStyle = TH.ink; c.fillText(s, x + 26, y + 40); c.restore(); }); });
}
function dImages(c, t, D) {
  base(c, 60, 60, 760, 470); const T = t % 8, imgs = D.imgs || [], n = Math.max(imgs.length, 4) > 4 ? 4 : Math.max(imgs.length, 4);
  const pal = [['#ff9a76', '#ff6b57'], ['#2b3a67', '#6a8cff'], ['#f6d365', '#fda085'], ['#1f2937', '#4b5563']];
  for (let i = 0; i < n; i++) { const x = 90 + (i % 2) * 360, y = 90 + Math.floor(i / 2) * 215, w = 340, h = 200, p = seg(T, .4 + i * .8, .6); if (p <= 0) continue;
    c.save(); c.globalAlpha = p; const s = 1.25 - .25 * p, cx = x + w / 2, cy = y + h / 2 - (1 - p) * 40; c.translate(cx, cy); c.rotate((1 - p) * (i % 2 ? .08 : -.08)); c.scale(s, s); c.translate(-cx, -cy - 0 + (y + h / 2 - cy) * 0);
    c.shadowColor = 'rgba(24,28,35,.28)'; c.shadowBlur = 18 * p; c.shadowOffsetY = 6; c.fillStyle = '#fff'; rr(c, x - 6, y - 6, w + 12, h + 12, 8); c.fill(); c.shadowColor = 'transparent';
    c.save(); rr(c, x, y, w, h, 5); c.clip(); const im = imgs[i];
    if (im && im.complete && im.naturalWidth) { const r = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * r, ih = im.naturalHeight * r; c.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
    else { const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal[i % 4][0]); g.addColorStop(1, pal[i % 4][1]); c.fillStyle = g; c.fillRect(x, y, w, h); }
    c.restore(); c.restore(); }
  const k = clamp((T - .2) / 3.4) ; if (T < 3.9) cursor(c, 160 + k * 360, 420 - Math.sin(k * 3.14) * 160, 1 - clamp((T - 3.2) / .6));
}
function dWidget(c, t, D) {
  base(c, 60, 70, 760, 430); const x = 80, y = 90, w = 720, h = 330, T = t % 10;
  c.save(); rr(c, x, y, w, h, 8); c.clip();
  const v = D.video; if (v && v.readyState >= 2 && v.videoWidth) { const r = Math.max(w / v.videoWidth, h / v.videoHeight), iw = v.videoWidth * r, ih = v.videoHeight * r; c.drawImage(v, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
  else { const g = c.createLinearGradient(80, 90, 800, 480); g.addColorStop(0, '#1a2233'); g.addColorStop(1, '#3a2230'); c.fillStyle = g; c.fillRect(x, y, w, h); c.fillStyle = TH.accent; c.beginPath(); c.arc(440, 255, 54, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(424, 228); c.lineTo(424, 282); c.lineTo(470, 255); c.closePath(); c.fill(); }
  c.restore(); c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, 110, 388, 660, 8, 4); c.fill(); c.fillStyle = TH.accent; rr(c, 110, 388, 660 * (T / 10), 8, 4); c.fill(); txt(c, D.widgetTitle, 90, 458, 28, TH.muted);
}
function dBoards(c, t, D) {
  base(c, 60, 60, 760, 470); const T = t % 9.5, open = seg(T, 1.5, 1.3), close = seg(T, 6.6, 1.3), k = open - close;
  const names = lines(D.boards.replace(/\|/g, '\n')).slice(0, 3), subs = lines(D.subBoards.replace(/\|/g, '\n')).slice(0, 3), cols = ['#ffe3dd', '#dfe9ff', '#e4f3e1'];
  c.save(); rr(c, 61, 61, 758, 468, 10); c.clip();
  // Breadcrumb
  const crumb = k > .5 ? `${D.boardsTitle}  ›  ${names[0] || ''}` : D.boardsTitle; ICO.folder(c, 100, 98); txt(c, crumb, 150, 112, 36, TH.ink, 700);
  // Außenansicht: zoomt in das erste Board
  c.save(); const fx = 100 + 215 / 2, fy = 170 + 150; c.translate(fx, fy); const sc = 1 + k * 3.4; c.scale(sc, sc); c.translate(-fx, -fy); c.globalAlpha = clamp(1 - k * 1.5);
  names.forEach((nm, i) => { const x = 100 + i * 235; c.fillStyle = TH.surface2; rr(c, x, 170, 215, 300, 8); c.fill(); c.strokeStyle = TH.border; c.lineWidth = 2; rr(c, x, 170, 215, 300, 8); c.stroke();
    c.fillStyle = cols[i % 3]; rr(c, x + 14, 184, 187, 160, 6); c.fill(); c.fillStyle = '#fff'; rr(c, x + 30, 202, 70, 46, 4); c.fill(); rr(c, x + 112, 246, 74, 56, 4); c.fill(); rr(c, x + 40, 280, 60, 40, 4); c.fill(); txt(c, nm, x + 18, 396, 28, TH.ink, 700); txt(c, `${3 + i * 2} cards`, x + 18, 436, 22, TH.faint); });
  c.restore();
  // Innenansicht: Unter-Boards in dem Board
  if (k > .02) { c.save(); c.globalAlpha = clamp((k - .35) * 1.8); const s2 = .85 + .15 * k; c.translate(440, 330); c.scale(s2, s2); c.translate(-440, -330);
    c.fillStyle = TH.surface2; rr(c, 90, 150, 700, 350, 8); c.fill();
    subs.forEach((nm, i) => { const p = seg(T, 3 + i * .5, .5), x = 120 + i * 220, y = 190 - (1 - p) * 30; c.save(); c.globalAlpha *= p; c.fillStyle = TH.surface; c.shadowColor = 'rgba(24,28,35,.16)'; c.shadowBlur = 10; c.shadowOffsetY = 3; rr(c, x, y, 200, 210, 8); c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = TH.border; c.lineWidth = 2; rr(c, x, y, 200, 210, 8); c.stroke();
      c.fillStyle = cols[(i + 1) % 3]; rr(c, x + 12, y + 12, 176, 100, 5); c.fill(); ICO.folder(c, x + 16, y + 132); txt(c, nm, x + 56, y + 150, 24, TH.ink, 700); txt(c, 'sub-board', x + 18, y + 186, 18, TH.faint); c.restore(); });
    c.restore(); }
  if (T > .6 && T < 2) cursor(c, 160 + seg(T, .6, .8) * 20, 330 + 20 - seg(T, .6, .8) * 40, 1 - clamp((T - 1.7) / .3));
  c.restore();
}
function dConnect(c, t, D) {
  base(c, 40, 50, 800, 490); const T = t % 9, names = lines(D.connect.replace(/\|/g, '\n')).slice(0, 5);
  const pos = [[210, 270], [450, 430], [690, 270], [450, 150], [450, 290]];
  const E = []; for (let i = 0; i < names.length - 1; i++) E.push([i, i + 1]); if (names.length > 3) E.push([0, 3].slice(), [3, 2]);
  const nodeAt = (i) => pos[i % pos.length];
  const edges = names.length === 4 ? [[0, 1], [1, 2], [0, 3], [3, 2]] : E.filter(([a, b]) => a < names.length && b < names.length);
  c.strokeStyle = TH.accent; c.lineWidth = 5; c.lineCap = 'round';
  edges.forEach(([a, b], ei) => { const p = seg(T, 1.1 + ei * .7, .7); if (p <= 0) return; const A = nodeAt(a), B = nodeAt(b); c.beginPath(); for (let s = 0; s <= 24; s++) { const u = s / 24 * p, m = 1 - u, x = m * m * m * (A[0] + 80) + 3 * m * m * u * (A[0] + 200) + 3 * m * u * u * (B[0] - 200) + u * u * u * (B[0] - 80), y = m * m * m * A[1] + 3 * m * m * u * A[1] + 3 * m * u * u * B[1] + u * u * u * B[1]; s ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); });
  names.forEach((nm, i) => { const [x, y] = nodeAt(i), p = seg(T, .2 + i * .22, .5); if (p <= 0) return; c.save(); c.globalAlpha = p; c.translate(x, y); c.scale(.85 + .15 * p, .85 + .15 * p); c.translate(-x, -y);
    c.fillStyle = TH.surface; c.shadowColor = 'rgba(24,28,35,.18)'; c.shadowBlur = 12; c.shadowOffsetY = 4; rr(c, x - 80, y - 38, 160, 76, 8); c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = TH.border; c.lineWidth = 3; rr(c, x - 80, y - 38, 160, 76, 8); c.stroke();
    c.fillStyle = TH.accent; c.beginPath(); c.arc(x - 80, y, 8, 0, 7); c.arc(x + 80, y, 8, 0, 7); c.fill(); c.textAlign = 'center'; let sz = 32; c.font = `500 ${sz}px ${FONT}`; while (sz > 16 && c.measureText(nm).width > 130) { sz -= 2; c.font = `500 ${sz}px ${FONT}`; } c.fillStyle = TH.ink; c.fillText(nm, x, y + 2); c.textAlign = 'left'; c.restore(); });
  if (T > 4 && T < 6.5) { const k = (T - 4) / 2.5; cursor(c, 300 + k * 260, 380 - Math.sin(k * 3.14) * 90, 1); }
}

function pattern(c, x, y, w, h) {
  const g = LK.bg;
  if (g === 'plain') return;
  if (g === 'gradient') { const gr = c.createLinearGradient(x, y, x + w * .6, y + h); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, TH.accent + '33'); c.fillStyle = gr; c.fillRect(x, y, w, h); return; }
  if (g === 'paper') { let sd = 7; c.fillStyle = TH.ink; for (let i = 0; i < 520; i++) { sd = (sd * 16807) % 2147483647; const a = sd / 2147483647; sd = (sd * 16807) % 2147483647; const b = sd / 2147483647; c.globalAlpha = .05 + (a * b) * .07; c.fillRect(x + a * w, y + b * h, 2, 2); } c.globalAlpha = 1; return; }
  c.fillStyle = TH.dot; c.strokeStyle = TH.dot; c.lineWidth = 1.4; const st = 26;
  for (let yy = y + 6; yy < y + h; yy += st) { if (g === 'lines') { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); } for (let xx = x + 6; xx < x + w; xx += st) { if (g === 'grid') { c.beginPath(); c.arc(xx, yy, 2.1, 0, 7); c.fill(); } else if (g === 'cross') { c.beginPath(); c.moveTo(xx - 5, yy); c.lineTo(xx + 5, yy); c.moveTo(xx, yy - 5); c.lineTo(xx, yy + 5); c.stroke(); } } }
  if (g === 'lines') for (let xx = x + 6; xx < x + w; xx += st) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
}

function cover(c, img, x, y, w, h, r, fb) {
  c.save(); rr(c, x, y, w, h, r); c.clip();
  if (img && img.complete && img.naturalWidth) { const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
  else { const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, fb[0]); g.addColorStop(1, fb[1]); c.fillStyle = g; c.fillRect(x, y, w, h); }
  c.restore();
}
function dWidgets(c, t, D) {
  base(c, 60, 60, 760, 470); const T = t % 9, im = D.imgs || [];
  const drop = (a) => seg(T, a, .6), place = (p, x, y, w, h, draw) => { if (p <= 0) return; c.save(); c.globalAlpha = p; const cx = x + w / 2, cy = y + h / 2 - (1 - p) * 36; c.translate(cx, cy); const k = 1.12 - .12 * p; c.scale(k, k); c.translate(-cx, -(y + h / 2)); c.shadowColor = 'rgba(24,28,35,.30)'; c.shadowBlur = 20 * p; c.shadowOffsetY = 8; c.fillStyle = TH.surface; rr(c, x, y, w, h, 12); c.fill(); c.shadowColor = 'transparent'; draw(); c.restore(); };
  // 1 Bild-Widget
  place(drop(.3), 96, 112, 252, 306, () => { cover(c, im[0], 108, 124, 228, 238, 8, ['#ff9a76', '#ff6b57']); txt(c, D.wImgText, 112, 386, 22, TH.ink, 600); txt(c, 'Image', 112, 408, 16, TH.faint); });
  // 2 YouTube
  place(drop(.9), 376, 104, 404, 236, () => {
    cover(c, im[1], 386, 114, 384, 190, 8, ['#1a2233', '#3a2230']); c.fillStyle = '#ff0033'; rr(c, 538, 180, 80, 56, 14); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(568, 195); c.lineTo(568, 221); c.lineTo(592, 208); c.closePath(); c.fill();
    c.fillStyle = '#ff0033'; rr(c, 400, 126, 30, 21, 6); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(411, 131); c.lineTo(411, 142); c.lineTo(421, 136.5); c.closePath(); c.fill(); txt(c, 'YouTube', 438, 137, 18, '#fff', 700);
    c.fillStyle = 'rgba(255,255,255,.3)'; rr(c, 398, 286, 360, 6, 3); c.fill(); c.fillStyle = '#ff0033'; rr(c, 398, 286, 360 * ((T % 6) / 6), 6, 3); c.fill(); txt(c, D.wYtText, 392, 322, 22, TH.ink, 600); });
  // 3 Spotify
  place(drop(1.5), 376, 358, 404, 136, () => {
    c.save(); c.fillStyle = '#121212'; rr(c, 376, 358, 404, 136, 12); c.fill(); c.restore(); cover(c, im[2], 392, 374, 104, 104, 8, ['#1db954', '#0a5a2a']);
    c.fillStyle = '#1db954'; c.beginPath(); c.arc(756, 380, 11, 0, 7); c.fill(); txt(c, D.wSpText, 512, 398, 24, '#fff', 700); txt(c, D.wSpSub, 512, 426, 17, '#b3b3b3');
    c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, 512, 452, 238, 5, 3); c.fill(); c.fillStyle = '#1db954'; rr(c, 512, 452, 238 * ((T % 7) / 7), 5, 3); c.fill();
    for (let i = 0; i < 4; i++) { const hh = 8 + Math.abs(Math.sin(T * 5 + i * 1.7)) * 16; c.fillStyle = '#1db954'; c.fillRect(724 + i * 8, 436 - hh, 5, hh); } });
}

/* ---- Look-Finder-Station: Mauszeiger klickt sich per Scroll durch die Einstellungen ---- */
const LC = { cx: (i) => 566 + i * 30, cy: 160, mode: [594, 227], sx: 566, sw: 234, sy: [290, 340, 390], fx: (k) => 566 + k * 80 + 36, fy: 443, by: 498, keep: [683, 546] };
const lerp = (a, b, t) => a + (b - a) * t;
const eio = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
/* Zufälliger Ablauf: bei jedem Laden andere Farben, Schrift, Hintergrund und Rundung (nie ganz rund). Der End-Look bleibt danach aktiv. */
const rnd = (a) => a[Math.floor(Math.random() * a.length)], rf = (a, b) => a + Math.random() * (b - a);
const PLAN = (() => {
  const ids = ['mono', 'matcha', 'cherry', 'blue', 'green', 'orange', 'lilac', 'mocha'];
  const pick = (ex) => rnd(ids.filter(i => !ex.includes(i)));
  const p1 = pick([]), p2 = pick([p1]), pf = pick([p1, p2]);
  return { p1, p2, pf, dark: Math.random() < .4, rf: rnd([0, 8, 12, 16, 20, 26]), rp: rf(38, 48), shf: rf(.15, .6), bdf: rf(.15, .6), font: rnd(['default', 'serif', 'mono']), bg: rnd(['grid', 'lines', 'paper']) };
})();
const WP = (() => {
  const P = PLAN, ix = (id) => ['mono', 'matcha', 'cherry', 'blue', 'green', 'orange', 'lilac', 'mocha'].indexOf(id), sx = (v) => LC.sx + LC.sw * v;
  const w = [[0, 840, 610], [.6, LC.cx(ix(P.p1)), 160], [1.0, LC.cx(ix(P.p1)) + 2, 162], [1.2, LC.cx(ix(P.p2)), 160], [1.5, LC.cx(ix(P.p2)) + 2, 162], [1.7, LC.cx(ix(P.pf)), 160], [2.0, LC.cx(ix(P.pf)) + 2, 162], [2.3, 594, 227], [2.5, 596, 229]];
  if (!P.dark) w.push([2.8, 596, 229]);
  w.push([3.2, sx(10 / 64), 290], [3.9, sx(P.rp / 64), 290], [4.2, sx(P.rp / 64), 290], [4.7, sx(P.rf / 64), 290], [4.9, sx(.35), 340], [5.3, sx(.9), 340], [5.5, sx(.9), 340], [5.8, sx(P.shf), 340], [6.2, sx(.4), 390], [6.5, sx(.85), 390], [6.6, sx(.85), 390], [6.95, sx(P.bdf), 390], [7.3, LC.fx(['default', 'serif', 'mono'].indexOf(P.font)), 443], [7.5, LC.fx(['default', 'serif', 'mono'].indexOf(P.font)) + 2, 445], [8.2, LC.fx(['grid', 'lines', 'paper'].indexOf(P.bg)), 498], [8.4, LC.fx(['grid', 'lines', 'paper'].indexOf(P.bg)) + 2, 500], [8.9, 683, 546], [9.6, 685, 548], [10, 780, 640]);
  return w;
})();
const CLICKS = [.95, 1.45, 1.95, 2.35, ...(PLAN.dark ? [] : [2.8]), 7.4, 8.3, 9.2];
const LOOK_BASE = { pal: 'default', dark: false, r: 10, font: 'default', bg: 'grid', shV: .35, bdV: .4 };
function lookState(T) {
  if (T < 0) return { ...LOOK_BASE, kept: false, T };
  const P = PLAN, kf = (arr) => { if (T <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (T <= arr[i][0]) { const a = arr[i - 1], b = arr[i]; return lerp(a[1], b[1], eio((T - a[0]) / (b[0] - a[0]))); } return arr[arr.length - 1][1]; };
  const pal = T >= 1.95 ? P.pf : T >= 1.45 ? P.p2 : T >= .95 ? P.p1 : 'default';
  const dark = T >= 2.35 && (P.dark || T < 2.8);
  return { pal, dark, r: kf([[3.2, 10], [3.9, P.rp], [4.2, P.rp], [4.7, P.rf]]), font: T >= 7.4 ? P.font : 'default', bg: T >= 8.3 ? P.bg : 'grid', shV: kf([[4.9, .35], [5.3, .9], [5.5, .9], [5.8, P.shf]]), bdV: kf([[6.2, .4], [6.5, .85], [6.6, .85], [6.95, P.bdf]]), kept: T >= 9.2, T };
}
function cursorAt(T) { for (let i = 1; i < WP.length; i++) if (T <= WP[i][0]) { const a = WP[i - 1], b = WP[i], k = eio((T - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; } return [WP[WP.length - 1][1], WP[WP.length - 1][2]]; }
function dLook(c, T) {
  const S = lookState(T);
  base(c, 40, 40, 800, 540);
  // Vorschau-Board links
  c.save(); rr(c, 54, 54, 470, 512, 8); c.clip(); c.fillStyle = TH.bg; c.fillRect(50, 50, 480, 520); pattern(c, 54, 54, 470, 512);
  const mini = (x, y, w, h) => { c.save(); if (LK.shA > 0) { c.shadowColor = `rgba(24,28,35,${Math.min(.55, LK.shA * 1.1)})`; c.shadowBlur = LK.shB * .7; c.shadowOffsetY = LK.shY * .6; } c.fillStyle = TH.surface; rr(c, x, y, w, h, 10); c.fill(); c.restore(); if (LK.bw > 0) { c.strokeStyle = LK.bc || TH.border; c.lineWidth = LK.bw; rr(c, x, y, w, h, 10); c.stroke(); } };
  mini(84, 96, 200, 160); txt(c, 'Moodboard', 104, 130, 26, TH.ink, 700); txt(c, 'Aa Bb 123', 104, 166, 20, TH.muted); c.fillStyle = TH.surface2; rr(c, 104, 192, 150, 11, 6); c.fill(); rr(c, 104, 214, 110, 11, 6); c.fill();
  mini(304, 112, 196, 130); [['Shoot', 1], ['Cut', 1], ['Grade', 0]].forEach(([s2, d], i) => { const y = 146 + i * 34; c.lineWidth = 3; c.strokeStyle = d ? TH.accent : TH.faint; rr(c, 322, y - 10, 20, 20, 6); if (d) { c.fillStyle = TH.accent; c.fill(); } else c.stroke(); txt(c, s2, 354, y + 1, 21, TH.ink); });
  mini(304, 266, 196, 120); const g2 = c.createLinearGradient(316, 278, 488, 374); g2.addColorStop(0, TH.accent); g2.addColorStop(1, TH.accentSoft); c.fillStyle = g2; rr(c, 316, 278, 172, 96, 6); c.fill();
  mini(84, 280, 200, 106); c.fillStyle = TH.accentSoft; rr(c, 98, 294, 80, 32, 8); c.fill(); txt(c, 'Idea', 112, 311, 18, TH.ink, 700); c.fillStyle = TH.surface2; rr(c, 188, 294, 82, 32, 8); c.fill(); txt(c, 'Doing', 200, 311, 18, TH.muted, 700); c.fillStyle = TH.accent; rr(c, 98, 340, 90, 30, 15); c.fill(); txt(c, '+ New', 112, 355, 17, '#fff', 700);
  mini(120, 490, 300, 48); for (let i = 0; i < 6; i++) { const x = 150 + i * 46; if (i === 2) { c.fillStyle = TH.accentSoft; rr(c, x - 17, 496, 34, 36, 8); c.fill(); } c.strokeStyle = i === 2 ? TH.accent : TH.faint; c.lineWidth = 2.6; rr(c, x - 8, 506, 16, 16, 4); c.stroke(); }
  c.restore();
  // Steuerung rechts
  c.fillStyle = TH.border; c.fillRect(534, 60, 2, 500); txt(c, 'Look Finder', 566, 90, 28, TH.ink, 700);
  const lab = (s2, y) => txt(c, s2, 566, y, 16, TH.muted, 600);
  lab('Color world', 128); PALS.forEach((P, i) => { const x = LC.cx(i) + 10, y = LC.cy; c.fillStyle = P.bg; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); c.fillStyle = P.accent; c.beginPath(); c.arc(x, y, 12, -.8, 2.35); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 12, 0, 7); c.stroke(); if (S.pal === P.id) { c.strokeStyle = TH.accent; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 17, 0, 7); c.stroke(); } });
  lab('Mode', 196); { const x = 566, y = 214, w = 56, h = 26; c.fillStyle = S.dark ? TH.accent : TH.surface2; rr(c, x, y, w, h, 13); c.fill(); c.strokeStyle = LK.bc || TH.border; c.lineWidth = 1.5; rr(c, x, y, w, h, 13); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(S.dark ? x + w - 14 : x + 14, y + 13, 9, 0, 7); c.fill(); txt(c, S.dark ? 'Dark' : 'Light', x + 68, y + 14, 17, TH.ink); }
  const slider = (label, y, v) => { lab(label, y - 24); c.fillStyle = TH.surface2; rr(c, LC.sx, y - 3, LC.sw, 6, 3); c.fill(); c.fillStyle = TH.accent; rr(c, LC.sx, y - 3, LC.sw * v, 6, 3); c.fill(); c.fillStyle = '#fff'; c.strokeStyle = TH.accent; c.lineWidth = 3; c.beginPath(); c.arc(LC.sx + LC.sw * v, y, 11, 0, 7); c.fill(); c.stroke(); };
  slider('Corners', LC.sy[0], S.r / 64); slider('Shadow', LC.sy[1], S.shV); slider('Border', LC.sy[2], S.bdV);
  const btns = (label, y, arr, sel, fontOf) => { lab(label, y - 16); arr.forEach((nm, k) => { const x = 566 + k * 80, on = sel === nm; c.fillStyle = on ? TH.accentSoft : TH.surface2; rr(c, x, y, 72, 32, 8); c.fill(); c.strokeStyle = on ? TH.accent : (LK.bc || TH.border); c.lineWidth = on ? 2.5 : 1.5; rr(c, x, y, 72, 32, 8); c.stroke(); c.textAlign = 'center'; c.fillStyle = TH.ink; c.font = `500 ${fontOf ? 20 : 16}px ${fontOf ? FONTS[nm] : FONT}`; c.fillText(fontOf ? 'Aa' : nm, x + 36, y + 17); c.textAlign = 'left'; }); };
  btns('Font', 428, ['default', 'serif', 'mono'], S.font, true); btns('Background', 484, ['grid', 'lines', 'paper'], S.bg, false);
  { const [kx, ky] = LC.keep, press = S.T > 9.15 && S.T < 9.4 ? .96 : 1; c.save(); c.translate(kx, ky); c.scale(press, press); c.fillStyle = TH.accent; rr(c, -117, -17, 234, 34, 10); c.fill(); c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `700 18px ${FONT}`; c.fillText(S.kept ? '✓ Look kept' : 'Keep look', 0, 1); c.restore(); }
  // Klick-Wellen + Mauszeiger
  const [mx, my] = cursorAt(T); CLICKS.forEach(ct => { const d = T - ct; if (d > 0 && d < .55) { c.strokeStyle = TH.accent; c.globalAlpha = 1 - d / .55; c.lineWidth = 4; c.beginPath(); c.arc(mx, my, 6 + d * 60, 0, 7); c.stroke(); c.globalAlpha = 1; } });
  const fade = clamp(T / .5) * clamp((10 - T) / .5); if (fade > 0.02) cursor(c, mx - 4, my - 3, fade);
}
const DRAW = {
  note1: (c, t, D) => dNote(c, t, D, 'notes'), note2: (c, t, D) => dNote(c, t, D, 'list'),
  look: dLook, widgets: dWidgets, table: dTable, tasks: dTasks, columns: dColumns, images: dImages, widget: dWidget, boards: dBoards, connect: dConnect,
};

/* ============ Matrizen & Shader ============ */
const M = {
  id: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a,0,0,0, 0,t,0,0, 0,0,(fa + n) / (n - fa),-1, 0,0,2 * fa * n / (n - fa),0]); },
  tr(x, y, z) { const m = M.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  sc(x, y, z) { const m = M.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
};
const VS_Q = 'attribute vec2 aPos;attribute vec2 aUv;uniform mat4 uMVP;varying vec2 vUv;void main(){vUv=aUv;gl_Position=uMVP*vec4(aPos,0.,1.);}';
const FS_Q = `precision mediump float;uniform sampler2D uTex;uniform float uA,uG,uT,uSeed,uEdge;varying vec2 vUv;
float hh(float n){return fract(sin(n*91.345+uSeed*17.1)*43758.5453);}
void main(){vec2 uv=vUv;float band=floor(uv.y*16.+floor(uT*7.));float r=hh(band);float g=uG*step(.5,r);uv.x+=g*(r-.5)*.05;
float s=uG*.008*(.4+r);vec4 t0=texture2D(uTex,uv);vec3 c;c.r=texture2D(uTex,uv+vec2(s,0.)).r;c.g=t0.g;c.b=texture2D(uTex,uv-vec2(s,0.)).b;
float a=t0.a;gl_FragColor=vec4(c*uA,a*uA);}`;
const VS_L = 'attribute vec3 aPos;uniform mat4 uMVP;varying float vD;void main(){gl_Position=uMVP*vec4(aPos,1.);vD=gl_Position.w;}';
const FS_L = 'precision mediump float;uniform vec4 uC;varying float vD;void main(){float a=uC.a*clamp(1.-vD/16.,0.,1.);gl_FragColor=vec4(uC.rgb*a,a);}';
const VS_P_UNUSED = 'attribute vec3 aPos;uniform mat4 uMVP;uniform float uS;varying float vD;void main(){gl_Position=uMVP*vec4(aPos,1.);vD=gl_Position.w;gl_PointSize=max(1.,uS/gl_Position.w);}';
const FS_P = 'precision mediump float;uniform vec3 uC;varying float vD;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=(1.-d*2.)*clamp(1.-vD/18.,0.,1.);gl_FragColor=vec4(uC*a,a);}';
function prog(gl, vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u, a: (nm) => gl.getAttribLocation(p, nm) };
}
const buf = (gl, d) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return b; };



const FEATURES = [
  { t: 'Notes', card: 'note1', dock: 'note' }, { t: 'Tables', card: 'table', dock: 'table' }, { t: 'Tasks', card: 'tasks', dock: 'tasks' },
  { t: 'Widgets', card: 'widgets', dock: 'widgets' }, { t: 'Boards', card: 'boards', dock: 'boards' }, { t: 'Your look', card: 'look', dock: 'look' },
];
const I = (d) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${d}</svg>`;
const DOCK = [
  ['note', 'Notes', I('<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h7M9 14h7M9 18h4"/>')],
  ['image', 'Image', I('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5.5-5.5L13 15l3-3 4 4.5"/>')],
  ['widgets', 'Widgets', I('<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>')],
  ['columns', 'Columns', I('<rect x="3.5" y="4.5" width="4.6" height="15" rx="1.2"/><rect x="9.7" y="4.5" width="4.6" height="15" rx="1.2"/><rect x="15.9" y="4.5" width="4.6" height="15" rx="1.2"/>')],
  ['tasks', 'Tasks', I('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M6.8 9.2l1.3 1.3 2.3-2.3"/><path d="M12.5 9h5"/><path d="M6.8 15.2l1.3 1.3 2.3-2.3"/><path d="M12.5 15h5"/>')],
  ['table', 'Table', I('<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.3h17M3.5 14.7h17M9.2 4v16M15 4v16"/>')],
  ['boards', 'Boards', I('<path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v9A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z"/>')],
  ['look', 'Look', I('<circle cx="12" cy="12" r="8.5"/><circle cx="8.6" cy="10.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="12.4" cy="7.8" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.8" cy="11" r="1.2" fill="currentColor" stroke="none"/>')],
  ['connect', 'Connect', I('<circle cx="6" cy="17.5" r="2.2"/><circle cx="18" cy="6.5" r="2.2"/><path d="M7.7 16l8.6-7.6"/>')],
];

/* ============ Look-Finder (Daten aus der App) ============ */
const PALS = [
  { id: 'mono', bg: '#F4F4F5', accent: '#2B2D33', dark: { background: '#10151D', accent: '#9AA8DA' } },
  { id: 'matcha', bg: '#FDE9F1', accent: '#5E8F3E', ink: '#3A5A22', dark: { background: '#1E2B16', accent: '#F58DB2', ink: '#F8D5E2' } },
  { id: 'cherry', bg: '#FADADD', accent: '#D1122F' }, { id: 'blue', bg: '#D6E4F7', accent: '#1F5FE0' },
  { id: 'green', bg: '#D9E8D8', accent: '#1B7A43' }, { id: 'orange', bg: '#F8C79C', accent: '#F26A1B' },
  { id: 'lilac', bg: '#E9E1FB', accent: '#7B4DFF' }, { id: 'mocha', bg: '#EBDCCB', accent: '#7A4A2B' },
];
const hx = (h) => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mixc = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function themeFor(L, BASE) {
  const P = PALS.find(x => x.id === L.pal); if (!P) return BASE;
  if (L.dark) { const bg = P.dark ? P.dark.background : mixc(P.bg, '#0b0e14', .9), acc = P.dark ? P.dark.accent : mixc(P.accent, '#ffffff', .3), ink = (P.dark && P.dark.ink) || '#EDEFF3';
    return { ...BASE, bg, dot: mixc(bg, '#ffffff', .16), surface: mixc(bg, '#ffffff', .07), surface2: mixc(bg, '#ffffff', .12), ink, muted: mixc(ink, bg, .4), faint: mixc(ink, bg, .58), border: mixc(bg, '#ffffff', .2), accent: acc, accentSoft: mixc(acc, bg, .78) }; }
  const ink = P.ink || mixc(P.accent, '#0b0d12', .72);
  return { ...BASE, bg: P.bg, dot: mixc(P.bg, ink, .2), surface: mixc(P.bg, '#ffffff', .78), surface2: mixc(P.bg, '#ffffff', .5), ink, muted: mixc(ink, P.bg, .4), faint: mixc(ink, P.bg, .58), border: mixc(P.bg, ink, .18), accent: P.accent, accentSoft: mixc(P.accent, P.bg, .82) };
}
const LOOK0 = { pal: 'default', dark: false, r: 10, font: 'default', sh: 'soft', bd: 'default', bg: 'grid', move: true };
const AUTO = [
  { pal: 'matcha', dark: false, r: 12, font: 'serif', sh: 'soft', bd: 'default', bg: 'paper' },
  { pal: 'blue', dark: true, r: 6, font: 'default', sh: 'strong', bd: 'accent', bg: 'grid' },
  { pal: 'cherry', dark: false, r: 64, font: 'rounded', sh: 'soft', bd: 'none', bg: 'gradient' },
  { pal: 'mocha', dark: false, r: 0, font: 'mono', sh: 'none', bd: 'strong', bg: 'lines' },
  { pal: 'lilac', dark: true, r: 18, font: 'helvetica', sh: 'strong', bd: 'accent', bg: 'cross' },
  { pal: 'orange', dark: false, r: 32, font: 'default', sh: 'soft', bd: 'default', bg: 'plain' },
];
const SHADOWS = { none: [0, 0, 0], soft: [.16, 22, 8], strong: [.42, 14, 10] };
const BORDERS = { none: [0, null], default: [2, null], strong: [4, 'ink'], accent: [4, 'accent'] };
const UI = [
  ['pal', 'Color world', PALS.map(p => ({ v: p.id, sw: [p.bg, p.accent] }))],
  ['dark', 'Light / dark', [{ v: false, l: 'Light' }, { v: true, l: 'Dark' }]],
  ['r', 'Corners', [0, 6, 12, 24, 64].map(v => ({ v, rad: v }))],
  ['font', 'Font', ['default', 'rounded', 'serif', 'mono', 'helvetica'].map(v => ({ v, l: 'Aa', f: FONTS[v] }))],
  ['sh', 'Shadow', [{ v: 'none', l: 'None' }, { v: 'soft', l: 'Soft' }, { v: 'strong', l: 'Strong' }]],
  ['bd', 'Border', [{ v: 'none', l: 'None' }, { v: 'default', l: 'Thin' }, { v: 'strong', l: 'Bold' }, { v: 'accent', l: 'Accent' }]],
  ['bg', 'Background', ['grid', 'lines', 'cross', 'paper', 'gradient', 'plain'].map(v => ({ v, l: v }))],
  ['move', 'Motion', [{ v: false, l: 'Still' }, { v: true, l: 'Moving' }]],
];
const paperSvg = (ink) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .25 0 0 0 0 .2 0 0 0 .09 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>`)}")`;
const crossSvg = (col) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M8 13h10M13 8v10' stroke='${col}' stroke-width='1.4' fill='none'/></svg>`)}")`;
function stageBg(TH, bg) {
  const d = TH.dot;
  if (bg === 'grid') return `radial-gradient(circle, ${d} 1.5px, transparent 1.9px) 0 0 / 22px 22px, ${TH.bg}`;
  if (bg === 'lines') return `linear-gradient(${d} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${d} 1px, transparent 1px) 0 0 / 22px 22px, ${TH.bg}`;
  if (bg === 'cross') return `${crossSvg(d)} 0 0 / 26px 26px, ${TH.bg}`;
  if (bg === 'paper') return `${paperSvg()} 0 0 / 160px 160px, ${TH.bg}`;
  if (bg === 'gradient') return `linear-gradient(160deg, ${mixc(TH.bg, '#ffffff', .45)}, ${TH.bg} 45%, ${mixc(TH.bg, TH.accent, .2)})`;
  return TH.bg;
}
function mount(root, OPT) {
  const o = OPT; const D = {};
  for (const k of Object.keys(DEF)) D[k] = (o[k] !== undefined && o[k] !== '') ? o[k] : DEF[k];
  D.tableTitle = o.tableTitle || DEF.tableTitle; D.tasksTitle = o.tasksTitle || DEF.tasksTitle; D.columnsTitle = o.columnsTitle || DEF.columnsTitle; D.boardsTitle = o.boardsTitle || DEF.boardsTitle; D.widgetTitle = o.widgetTitle || DEF.widgetTitle;
  TH = { ...TH, bg: o.cBg || TH.bg, dot: o.cDot || TH.dot, surface: o.cSurface || TH.surface, ink: o.cInk || TH.ink, accent: o.cAccent || TH.accent };
  const BASE = { ...TH }; let lookIdx = -1, lookSig = '', ver = 0; const pver = [];
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h).trim()); return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, .42, .34]; };
  D.imgs = (o.images || []).map(i => i && i.src).filter(Boolean).slice(0, 4).map(src => { const im = new Image(); im.decoding = 'async'; im.onload = () => { D.dirtyImg = true; }; im.src = src; return im; });
  const ft = lines(D.featureText).map(l => { const [a, ...b] = l.split('|'); return { t: (a || '').trim(), d: b.join('|').trim() }; });
  const feats = FEATURES.map((f, i) => ({ ...f, t: (ft[i] && ft[i].t) || f.t, d: (ft[i] && ft[i].d) || '' }));
  const stations = [{ t: o.title || 'NOTUA', d: o.text || '', card: null }, ...feats, { t: o.endTitle || 'All in one place.', d: o.endText || '', card: null, end: true }];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas'); canvas.className = 'fl__cv'; canvas.setAttribute('aria-hidden', 'true');
  let gl = null; if (!reduce) { try { gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: true, alpha: true }); } catch { gl = null; } }
  const STATIONS = stations, N = STATIONS.length - 1, SP = 4.4, PL = 3.4, TOT = N + PL;
  const cvs = STATIONS.map(s => { if (!s.card) return null; const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; return cv; });
  const paint = (i, t) => { const s = STATIONS[i]; if (!cvs[i]) return; DRAW[s.card](cvs[i].getContext('2d'), t, D); };

  function staticFallback() {
    const wrap = document.createElement('div'); wrap.className = 'fl__static';
    STATIONS.forEach((s, i) => { const d = document.createElement('div'); if (cvs[i]) { paint(i, 99); const im = new Image(); im.src = cvs[i].toDataURL(); im.alt = ''; d.append(im); } const h = document.createElement('h3'); h.textContent = s.t; const p = document.createElement('p'); p.textContent = s.d; d.append(h, p); wrap.append(d); });
    const a = document.createElement('a'); a.href = o.linkUrl || 'https://notua.site/'; a.className = 'fl__cta'; a.style.display = 'inline-block'; a.textContent = o.linkText || 'open NOTUA ↗'; wrap.append(a); root.append(wrap);
  }
  function el(t, c) { const e = document.createElement(t); e.className = c; return e; }
  if (!gl) { staticFallback(); return; }
  STATIONS.forEach((s, i) => paint(i, 99));
  const hudCount = el('p', 'fl__count'), hudTitle = el('h2', 'fl__title'), hudText = el('p', 'fl__text'), hudCta = Object.assign(el('a', 'fl__cta'), { href: o.linkUrl || 'https://notua.site/', textContent: o.linkText || 'open NOTUA ↗', target: '_blank', rel: 'noopener' }), hudSub = el('p', 'fl__sub');
  const hudCta2 = Object.assign(el('a', 'fl__cta fl__cta2'), { href: o.projectUrl || 'notua', textContent: o.projectText || 'view the project →' }); hudCta2.setAttribute('data-link', '');
  const ctas = el('div', 'fl__ctas'); ctas.append(hudCta, hudCta2);
  const hud = el('div', 'fl__hud'); hud.append(hudCount, hudTitle, hudText, ctas, hudSub);
  const hint = el('p', 'fl__hint'); hint.textContent = o.hint || 'scroll to fly';
  const bar = el('i', 'fl__bar');
  const dock = el('div', 'fl__dock'); dock.setAttribute('role', 'toolbar');
  const dockKeys = [...new Set(STATIONS.map(x => x.dock).filter(Boolean))];
  const dockBtns = dockKeys.map(k => DOCK.find(d => d[0] === k)).filter(Boolean).map(([key, label, svgH]) => { const b = el('button', 'fl__tool'); b.type = 'button'; b.dataset.k = key; b.innerHTML = svgH + `<span>${label}</span>`; b.setAttribute('aria-label', label); dock.append(b); return b; });
  const stage = el('div', 'fl__stage');
    stage.append(canvas, el('div', 'fl__vig'), hud, hint, dock, bar);
  const track = el('div', 'fl__track'); track.append(stage); track.style.setProperty('--n', N + 1 + PL); root.append(track);


  // ---- Look-Finder: der Look wird aus dem Skript-Zustand (Scroll-Position) berechnet und auf die ganze Szene angewendet ----
  lookIdx = STATIONS.findIndex(x => x.card === 'look');
  let coral = [1, .42, .34], curBg = '';
  const applyState = (S) => {
    const sig = [S.pal, S.dark, Math.round(S.r), S.font, S.bg, Math.round(S.shV * 40), Math.round(S.bdV * 40)].join('|'); if (sig === lookSig) return; const prevSig = lookSig.split('|'); lookSig = sig;
    TH = themeFor({ pal: S.pal, dark: S.dark }, BASE);
    LK.rk = S.r / 10; LK.shA = S.shV <= .02 ? 0 : .04 + S.shV * .45; LK.shB = 10 + S.shV * 45; LK.shY = 4 + S.shV * 11; LK.bw = S.bdV <= .02 ? 0 : S.bdV * 5; LK.bc = mixc(TH.border, TH.accent, clamp((S.bdV - .5) * 2)); LK.bg = S.bg; FONT = FONTS[S.font] || FONTS.default;
    const rs = root.style; rs.setProperty('--coral', TH.accent); rs.setProperty('--ink', TH.ink); rs.setProperty('--mute', TH.muted); rs.setProperty('--surf', TH.surface); rs.setProperty('--surf2', TH.surface2); rs.setProperty('--bd', LK.bc); rs.setProperty('--accs', TH.accentSoft);
    rs.setProperty('--rad', Math.min(26, 4 + S.r * .7) + 'px'); rs.setProperty('--bw', (LK.bw ? Math.max(1, LK.bw / 2) : 0) + 'px'); rs.setProperty('--shd', LK.shA ? `0 10px 30px -10px rgba(24,28,35,${Math.min(.5, LK.shA * 1.7)})` : 'none');
    rs.background = TH.bg; rs.color = TH.ink; rs.fontFamily = FONT;
    const bgKey = [S.pal, S.dark, S.bg].join('|'); if (bgKey !== curBg) { curBg = bgKey; stage.style.background = stageBg(TH, S.bg); }
    coral = hexRgb(TH.accent); ver++; document.querySelector('.site-header')?.classList.toggle('over-fl-dark', !!S.dark);
  };
  applyState(lookState(-1));
  let Q, L;
  try { Q = prog(gl, VS_Q, FS_Q); L = prog(gl, VS_L, FS_L); } catch (e) { console.warn(e); root.replaceChildren(); staticFallback(); throw e; }
  const quad = buf(gl, new Float32Array([-.5,-.5,0,0, .5,-.5,1,0, -.5,.5,0,1, .5,.5,1,1]));
  const makeTex = (src) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const planes = STATIONS.map((s, i) => ({ i, tex: null, ratio: CW / CH, logo: !s.card, side: i % 2 ? 1 : -1, mvp: null }));
  planes.forEach((pl) => { if (cvs[pl.i]) pl.tex = makeTex(cvs[pl.i]); });
  const upload = (i) => { const pl = planes[i]; if (!pl.tex) return; gl.bindTexture(gl.TEXTURE_2D, pl.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs[i]); };
  const logo = new Image(); logo.onload = () => { const t = makeTex(logo); planes.forEach(pl => { if (pl.logo) { pl.tex = t; pl.ratio = 1; } }); }; logo.src = o.logo || 'media/notua-logo.png';

  let W = 1, Hh = 1, prog0 = 0, prevP = 0, vel = 0, gv = 0, px = 0, py = 0, tpx = 0, tpy = 0, active = -1, running = false, aT0 = 0; const t0 = performance.now();
  const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; Hh = canvas.clientHeight; canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(Hh * dpr)); };
  addEventListener('resize', resize);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) { stage.addEventListener('pointermove', (e) => { tpx = e.clientX / innerWidth * 2 - 1; tpy = e.clientY / innerHeight * 2 - 1; }); }
  const setActive = (i, now) => {
    if (i === active) return; const prev = active; active = i; aT0 = now; const s = STATIONS[i];
    if (prev >= 0 && cvs[prev]) { paint(prev, 99); upload(prev); }
    hud.classList.toggle('is-look', i === lookIdx);
    hudTitle.textContent = s.t; hudTitle.dataset.text = s.t; hudText.textContent = s.d;
    hudCount.textContent = i === 0 ? 'NOTUA' : i === N ? 'NOTUA' : `${String(i).padStart(2, '0')} / ${String(N - 1).padStart(2, '0')}`;
    hudSub.textContent = s.end ? (o.sub || '') : '';
    hud.classList.toggle('is-end', !!s.end);
    dockBtns.forEach(b => b.classList.toggle('is-on', b.dataset.k === s.dock));
    hudTitle.classList.remove('is-in'); void hudTitle.offsetWidth; hudTitle.classList.add('is-in');
  };
  setActive(0, 0);
  dock.addEventListener('click', (e) => { const b = e.target.closest('.fl__tool'); if (!b) return; const i = STATIONS.findIndex(x => x.dock === b.dataset.k); if (i < 0) return;
    const r = track.getBoundingClientRect(); const total = r.height - stage.offsetHeight; const q = (i <= lookIdx ? i : i + PL) / TOT; scrollTo({ top: scrollY + r.top + q * total + 2, behavior: 'smooth' }); });

  const fromProg = (pp) => { const q = pp * TOT; if (q < lookIdx) return [q, 0]; if (q < lookIdx + PL) return [lookIdx, (q - lookIdx) / PL]; return [q - PL, 1]; };
  const narrow = () => W / Hh < .8;
  function cardPos(i) { const wN = narrow(); if (i === 0) return wN ? [0, .62] : [0, 0]; if (i === N) return wN ? [0, .62] : [.9, 0]; if (i === lookIdx) return wN ? [0, .62] : [.62, 0]; return [wN ? (i % 2 ? .1 : -.1) : (.85 + (i % 2 ? .12 : -.05)), wN ? .08 : Math.sin(i * 2) * .12]; }
  const draw = (now) => {
    if (!running) return; requestAnimationFrame(draw);
    const t = (now - t0) / 1000; px += (tpx - px) * .06; py += (tpy - py) * .06;
    vel += (Math.abs(prog0 - prevP) * 90 - vel) * .2; prevP = prog0; gv += (clamp(vel * .7) * .35 - gv) * .25;
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const [f, lu] = fromProg(prog0); const asp = W / Hh, camZ = 3.0 - f * SP, camX = Math.sin(f * 1.1) * (narrow() ? .1 : .35), camY = Math.cos(f * .8) * .1;
    if (lookSig.split('|')[4] !== 'plain') stage.style.backgroundPosition = `${(-prog0 * TOT * 40 - px * 18).toFixed(1)}px ${(prog0 * TOT * 90 - py * 14).toFixed(1)}px`;
    const VP = M.mul(M.persp(.96, asp, .1, 40), M.mul(M.mul(M.rx(py * .05), M.ry(px * .09)), M.tr(-camX, -camY, -camZ)));
    // Verbindungslinien zwischen den Karten (wie die Verbinder in NOTUA)
    gl.useProgram(L.p); const link = []; for (let i = 1; i < N - 1; i++) { const A = cardPos(i), B = cardPos(i + 1); link.push(A[0], A[1], -i * SP, B[0], B[1], -(i + 1) * SP); }
    if (!draw.linkBuf || draw.nr !== narrow()) { draw.nr = narrow(); draw.linkBuf = buf(gl, new Float32Array(link)); }
    gl.bindBuffer(gl.ARRAY_BUFFER, draw.linkBuf); const a = L.a('aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0); gl.uniformMatrix4fv(L.u.uMVP, false, VP); gl.uniform4f(L.u.uC, coral[0], coral[1], coral[2], .55); gl.drawArrays(gl.LINES, 0, link.length / 3);
    // Flächen
    gl.useProgram(Q.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad); const ap = Q.a('aPos'), au = Q.a('aUv'); gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(au);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(au, 2, gl.FLOAT, false, 16, 8); gl.uniform1i(Q.u.uTex, 0); gl.uniform1f(Q.u.uT, t);
    let near = 0, nd = 1e9, t0k = 0;
    for (const pl of planes.slice().reverse()) {
      if (!pl.tex) continue; const z = -pl.i * SP, d = camZ - z; if (Math.abs(f - pl.i) < nd) { nd = Math.abs(f - pl.i); near = pl.i; }
      if (d < .5 || d > 16) continue;
      const wN = narrow(); const [bx, by] = cardPos(pl.i); const ev = ENT[pl.i % ENT.length], ek = pl.i === 0 ? 0 : (t0k = clamp((d - 3.4) / 7), t0k * t0k * (3 - 2 * t0k)), sc2 = wN ? .3 : 1, x = bx + ev[0] * ek * sc2, y = by + ev[1] * ek * sc2;
      const isL = pl.i === lookIdx; const wd = pl.logo ? (wN ? Math.min(.9, 1.5 * asp) : 1.3) : isL ? (wN ? Math.min(1.3, 2.6 * asp) : 2.7) : (wN ? Math.min(1.0, 2.1 * asp) : 2.2), ht = wd / pl.ratio;
      const ang = pl.logo || isL ? ev[0] * ek * -.12 : (wN ? .05 : .22) * -pl.side + Math.sin(t * .6 + pl.i) * .02;
      const m = M.mul(M.mul(M.tr(x, y, z), M.mul(M.ry(ang), pl.logo ? M.rz(Math.sin(t * .5) * .04) : M.rz(ev[1] * ek * .1))), M.sc(wd, ht, 1));
      const fade = clamp((d - .5) / 1.3) * clamp(1 - (d - 8) / 8);
      const fadeEnd = pl.i === N ? clamp((f - (N - 1) - .2) / .5) : 1;
      const mvp = M.mul(VP, m); pl.mvp = mvp; pl.fade = fade;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pl.tex); gl.uniformMatrix4fv(Q.u.uMVP, false, mvp); gl.uniform1f(Q.u.uA, fade * fadeEnd); gl.uniform1f(Q.u.uSeed, pl.i + 1);
      gl.uniform1f(Q.u.uG, gv * (.4 + .6 * clamp(1 - Math.abs(f - pl.i)))); gl.uniform1f(Q.u.uEdge, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    setActive(near, now);
    // Look-Skript: Zustand aus der Scroll-Position (nur im Look-Abschnitt), sonst Standard-Look
    const lookT = Math.abs(f - lookIdx) < .01 ? (active === lookIdx ? lu * 10 : -1) : (f > lookIdx ? 99 : -1); applyState(lookState(lookT));
    if (cvs[active] && active === near && Math.abs(f - active) < .6) { const pl = planes[active]; paint(active, active === lookIdx ? lookT : (now - aT0) / 1000); pver[active] = ver; upload(active); }
    if (D.dirtyImg) { D.dirtyImg = false; ver++; }
    for (let i = 0; i < STATIONS.length; i++) if (cvs[i] && i !== active && pver[i] !== ver && Math.abs(f - i) < 2.6) { paint(i, 99); upload(i); pver[i] = ver; }
    hud.style.setProperty('--gl', '0'); bar.style.transform = `scaleX(${prog0.toFixed(4)})`; hint.style.opacity = prog0 < .03 ? '1' : '0';
  };
  new IntersectionObserver((es) => { if (es[0].isIntersecting) { if (!running) { running = true; resize(); requestAnimationFrame(draw); } } else { running = false; } }, { rootMargin: '10%' }).observe(stage);
  const onScroll = () => { const r = track.getBoundingClientRect(); prog0 = clamp(-r.top / Math.max(1, r.height - stage.offsetHeight)); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

// Einflug-Richtungen: jede Karte kommt aus einer anderen Ecke (weit hinten, klein) und gleitet auf ihre Position
const ENT = [[0, 0], [-3.4, .6], [3.4, -.7], [2.6, 2.2], [-3, -1.8], [3.6, 1.4], [-2.6, 2], [3, -1.9], [-3.2, .3]];
const IMG = [{ name: 'src', label: 'Bild', type: 'image' }];
export default {
  type: 'notuaFlight', label: 'NOTUA-Flug (meine eigene App, 3D)',
  fields: [
    { name: 'title', label: 'Titel am Anfang', type: 'text', default: 'NOTUA – the most powerful creative planning & mind-map app.', de: 'NOTUA – die mächtigste Planungs- und Mindmap-App für Kreative.' },
    { name: 'text', label: 'Text am Anfang (was kann NOTUA, wofür ist es?)', type: 'textarea', default: 'Plan projects, sort ideas and connect them on one endless board: notes, tables, tasks, widgets and boards inside boards. Made by me – free to use.', de: 'Plane Projekte, sortiere Ideen und verbinde sie auf einem endlosen Board: Notizen, Tabellen, Aufgaben, Widgets und Boards in Boards. Von mir gebaut – kostenlos nutzbar.' },
    { name: 'endTitle', label: 'Titel am Ende', type: 'text', default: 'Built, shipped, free to use.', de: 'Gebaut, veröffentlicht, kostenlos.' },
    { name: 'endText', label: 'Text am Ende', type: 'textarea', default: 'Runs in the browser, as a desktop app and on Android.', de: 'Läuft im Browser, als Desktop-App und auf Android.' },
    { name: 'linkText', label: 'Button 1: Text (öffnet die App)', type: 'text', default: 'open NOTUA ↗', de: 'NOTUA öffnen ↗' },
    { name: 'linkUrl', label: 'Button 1: Link', type: 'text', default: 'https://notua.site/' },
    { name: 'projectText', label: 'Button 2: Text (führt zur NOTUA-Projektseite)', type: 'text', default: 'view the project →', de: 'zum Projekt →' },
    { name: 'projectUrl', label: 'Button 2: Projekt (Name der Projektseite, z. B. notua)', type: 'text', default: 'notua' },
    { name: 'sub', label: 'Kleine Zeile unter den Buttons (am Ende)', type: 'text', default: 'web · desktop · android', de: 'Web · Desktop · Android' },
    { name: 'hint', label: 'Hinweis „scroll“', type: 'text', default: 'scroll to fly', de: 'scrollen und fliegen' },
    { name: 'logo', label: 'NOTUA-Logo (Bild)', type: 'image', default: 'media/notua-logo.png' },
    { name: 'featureText', label: 'Stationen: Titel | Beschreibung (eine Zeile je Station, Reihenfolge: Notes, Tables, Tasks, Widgets, Boards, Your look)', type: 'textarea', default: DEF.featureText, de: 'Notizen | Halte Ideen fest, sobald sie auftauchen – Skripte, Shot-Notizen, Gedanken. Alles liegt auf einer endlosen Fläche.\nTabellen | Szenenübersicht, Budget, Zeitplan – übersichtlich in Zellen.\nAufgaben | Hak ab, was erledigt ist, und behalte den Rest im Blick.\nWidgets | Pinne Bilder, YouTube-Videos und Spotify-Playlists direkt neben deine Ideen.\nBoards | Boards in Boards – jedes Projekt bekommt seinen eigenen Raum.\nDein Look | Mach es zu deinem: Farbwelt, hell oder dunkel, Ecken, Schatten, Rahmen und Schrift. Dann behalte den Look.' },
    { name: 'notes', label: 'Notes-Karte: Text (eine Zeile pro Zeile; wird getippt, 1. Zeile = Titel)', type: 'textarea', default: DEF.notes, de: 'Skript-Intro\n– Hook in 3 Sek.\n– Szene 1: Werkstatt\n– Szene 2: Interview' },
    { name: 'tableTitle', label: 'Table-Karte: Titel', type: 'text', default: DEF.tableTitle, de: 'Szenenübersicht' },
    { name: 'table', label: 'Table-Karte: Zeilen (Zellen mit Komma trennen, max. 4 Zeilen/4 Spalten)', type: 'textarea', default: DEF.table, de: 'Intro, 0:12, Totale\nWerkstatt, 0:28, Nahaufnahme\nInterview, 0:45, Halbnah' },
    { name: 'tasksTitle', label: 'Tasks-Karte: Titel', type: 'text', default: DEF.tasksTitle, de: 'Aufgaben' },
    { name: 'tasks', label: 'Tasks-Karte: Aufgaben (Zeile mit „x “ am Anfang = wird abgehakt)', type: 'textarea', default: DEF.tasks, de: 'x Material sichten\nx Rohschnitt\nx Color Grading\nSounddesign\nExport in 4K' },
    { name: 'images', label: 'Widgets-Karte: 3 Bilder – 1 = Bild-Widget, 2 = YouTube-Vorschau, 3 = Spotify-Cover', type: 'list', itemFields: IMG },
    { name: 'wImgText', label: 'Widgets: Beschriftung Bild', type: 'text', default: DEF.wImgText },
    { name: 'wYtText', label: 'Widgets: YouTube-Titel', type: 'text', default: DEF.wYtText, de: 'Hinter den Kulissen' },
    { name: 'wSpText', label: 'Widgets: Spotify-Titel', type: 'text', default: DEF.wSpText, de: 'Late-Night-Mix' },
    { name: 'wSpSub', label: 'Widgets: Spotify-Untertitel', type: 'text', default: DEF.wSpSub },
    { name: 'boardsTitle', label: 'Boards-Karte: Titel', type: 'text', default: DEF.boardsTitle },
    { name: 'boards', label: 'Boards-Karte: Namen der Boards (mit | trennen, max. 3)', type: 'text', default: DEF.boards, de: 'Shoot 2026 | Kunden | Ideen' },
    { name: 'subBoards', label: 'Boards-Karte: Unter-Boards im ersten Board (mit | trennen)', type: 'text', default: DEF.subBoards, de: 'Tag 1 | Tag 2 | B-Roll' },
    { name: 'cBg', label: 'Basis-Look: Hintergrund (Hex)', type: 'text', default: '#E7EAEE' },
    { name: 'cDot', label: 'Basis-Look: Punktraster (Hex)', type: 'text', default: '#C6CCD4' },
    { name: 'cSurface', label: 'Basis-Look: Karten (Hex)', type: 'text', default: '#FFFFFF' },
    { name: 'cInk', label: 'Basis-Look: Text (Hex)', type: 'text', default: '#1B2027' },
    { name: 'cAccent', label: 'Basis-Look: Akzentfarbe (Hex)', type: 'text', default: '#FF6B57' },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const root = document.createElement('section'); root.className = 'fl'; if (p.id) root.id = p.id;
    const go = () => { try { mount(root, p); } catch (e) { console.error(e); } };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '150% 0px' }); io.observe(root); root.style.minHeight = '100svh'; }
    else go();
    return root;
  },
};
