// Gemeinsame Animations-Logik für „Laptop 3D“ (Seite + Admin-Vorschau).
// Eine Animation besteht aus Start-, optional Mitte- und Endpose. Position x/y sind in % der Bühnenbreite/-höhe, gemessen von der Endposition (0/0 = Laptop an seinem Platz im Layout).
export const LAP_FIN = { 'space schwarz': [.075, .077, .086], silber: [.74, .75, .78], 'space grau': [.3, .31, .34], mitternacht: [.1, .14, .24], sternenlicht: [.82, .77, .7], gold: [.78, .66, .46] };
export const hexc = (v) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
// pw = Stärke des Abbremsens (1 = gleichmäßig, 3 = schnell am Anfang und langsam am Ende, 6 = sehr stark)
export const easeOut = (t, pw = 3) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), pw);
export const easeOutInv = (v, pw = 3) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 1 / pw);
// Geschwindigkeitskurve: erst langsamer Anlauf, der exponentiell schneller wird (acc), am Ende wieder langsam einlaufen (ease)
export const eA = (a, t) => easeOut(Math.pow(Math.min(1, Math.max(0, t)), a && a.acc > 0 ? a.acc : 1), a && a.ease > 0 ? a.ease : 3);
export const eAi = (a, v) => Math.pow(easeOutInv(v, a && a.ease > 0 ? a.ease : 3), 1 / (a && a.acc > 0 ? a.acc : 1));

// Standard-Animation (entspricht der bisherigen: zugeklappt beim Text starten → auf den Platz fahren, drehen, öffnen)
export function defaultAnim(side = 'right', mobile = false) {
  const d = side === 'left' ? -1 : 1;
  if (mobile) return { span: .45, dur: 4.5, acc: 2, ease: 3, pre: .85, textAt: .42, mid: false, hold: .12, fi: 0, fo: 0,
    s: { x: -45 * d, y: -8, ry: 0, rx: 80, rz: 0, open: 0, fit: .9 },
    m: { t: .45, x: -10 * d, y: -4, ry: 38 * d, rx: 38, rz: 0, open: .55, fit: .8 },
    e: { x: 0, y: 0, ry: -12 * d, rx: 12, rz: 0, open: 1, fit: .86 } };
  return { span: .45, dur: 4.5, acc: 2, ease: 3, pre: .85, textAt: .42, mid: false, hold: .12, fi: 0, fo: 0,
    s: { x: -40 * d, y: -13, ry: 0, rx: 80, rz: 0, open: 0, fit: 1.1 },
    m: { t: .45, x: -12 * d, y: -6, ry: 38 * d, rx: 38, rz: 0, open: .55, fit: .9 },
    e: { x: 0, y: 0, ry: -15 * d, rx: 11, rz: 0, open: 1, fit: 1.1 } };
}
export const normAnim = (a, side, mobile = false) => { const d = defaultAnim(side, mobile); if (!a || typeof a !== 'object') return d; return { ...d, ...a, s: { ...d.s, ...a.s }, m: { ...d.m, ...a.m }, e: { ...d.e, ...a.e } }; };
const KEYS = ['x', 'y', 'ry', 'rx', 'rz', 'open', 'fit'];
// t = 0..1 (bereits angepasster Fortschritt). Mit Mitte läuft die Bewegung weich durch alle drei Posen (quadratisch), sonst gerade von Start zu Ende.
export function pose(a, t) {
  const o = {}; const tm = Math.min(.9, Math.max(.1, Number(a.m.t) || .5));
  for (const k of KEYS) {
    const s = Number(a.s[k]) || 0, e = Number(a.e[k]) || 0, m = Number(a.m[k]) || 0;
    o[k] = a.mid ? s * ((t - tm) * (t - 1)) / (tm) + m * (t * (t - 1)) / (tm * (tm - 1)) + e * (t * (t - tm)) / (1 - tm) : s + (e - s) * t;
  }
  o.open = Math.min(1, Math.max(0, o.open)); return o;
}

// Scrollstop am Mittelpunkt: u (0..1, nach easeOut) bleibt für einen kleinen Scroll-Abschnitt (hold) auf der Mittelpose stehen
export function holdRange(a) { const tm = Math.min(.9, Math.max(.1, Number(a.m.t) || .5)), h = Math.min(.4, Math.max(0, Number(a.hold) || 0)), lo = tm * (1 - h), hi = Math.min(.97, lo + h); return [lo, hi, tm]; }
export function holdT(a, u) {
  if (!a.mid || !(Number(a.hold) > 0)) return u;
  const [lo, hi, tm] = holdRange(a);
  return u <= lo ? u / lo * tm : u >= hi ? tm + (u - hi) / (1 - hi) * (1 - tm) : tm;
}

// Ein-/Ausblenden: fi = Anteil der Animation am Anfang, in dem der Laptop einblendet (0 = aus), fo = Anteil am Ende, in dem er ausblendet
export function alphaAt(a, u) {
  const fi = Math.min(.9, Math.max(0, Number(a.fi) || 0)), fo = Math.min(.9, Math.max(0, Number(a.fo) || 0)), sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  return (fi > 0 ? sm(u / fi) : 1) * (fo > 0 ? sm((1 - u) / fo) : 1);
}
