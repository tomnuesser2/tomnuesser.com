// Gemeinsame Animations-Logik für „Laptop 3D“ (Seite + Admin-Vorschau).
// Eine Animation besteht aus Start-, optional Mitte- und Endpose. Position x/y sind in % der Bühnenbreite/-höhe, gemessen von der Endposition (0/0 = Laptop an seinem Platz im Layout).
export const LAP_FIN = { 'space schwarz': [.075, .077, .086], silber: [.74, .75, .78], 'space grau': [.3, .31, .34], mitternacht: [.1, .14, .24], sternenlicht: [.82, .77, .7], gold: [.78, .66, .46] };
export const hexc = (v) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutInv = (v) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 1 / 3);

// Standard-Animation (entspricht der bisherigen: zugeklappt beim Text starten → auf den Platz fahren, drehen, öffnen)
export function defaultAnim(side = 'right') {
  const d = side === 'left' ? -1 : 1;
  return { span: .26, textAt: .42, mid: false,
    s: { x: -40 * d, y: -13, ry: 0, rx: 80, open: 0, fit: 1.1 },
    m: { t: .45, x: -12 * d, y: -6, ry: 38 * d, rx: 38, open: .55, fit: .9 },
    e: { x: 0, y: 0, ry: -15 * d, rx: 11, open: 1, fit: 1.1 } };
}
export const normAnim = (a, side) => { const d = defaultAnim(side); if (!a || typeof a !== 'object') return d; return { ...d, ...a, s: { ...d.s, ...a.s }, m: { ...d.m, ...a.m }, e: { ...d.e, ...a.e } }; };
const KEYS = ['x', 'y', 'ry', 'rx', 'open', 'fit'];
// t = 0..1 (bereits angepasster Fortschritt). Mit Mitte läuft die Bewegung weich durch alle drei Posen (quadratisch), sonst gerade von Start zu Ende.
export function pose(a, t) {
  const o = {}; const tm = Math.min(.9, Math.max(.1, Number(a.m.t) || .5));
  for (const k of KEYS) {
    const s = Number(a.s[k]) || 0, e = Number(a.e[k]) || 0, m = Number(a.m[k]) || 0;
    o[k] = a.mid ? s * ((t - tm) * (t - 1)) / (tm) + m * (t * (t - 1)) / (tm * (tm - 1)) + e * (t * (t - tm)) / (1 - tm) : s + (e - s) * t;
  }
  o.open = Math.min(1, Math.max(0, o.open)); return o;
}
