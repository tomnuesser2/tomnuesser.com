// Ein gemeinsamer Scroll-Takt für alle scrollgesteuerten Blöcke (statt vieler eigener Listener).
// track(el, fn): fn(rect, vh) läuft bei jedem Scroll, solange el in der Nähe des Bildschirms ist.
import { prefersReducedMotion } from './dom.js';
const subs = new Set(); let queued = false, bound = false;
const run = () => {
  queued = false; const vh = innerHeight, live = [];
  // 1) alle Maße lesen (ein einziges Layout), 2) erst danach die Blöcke zeichnen lassen – sonst erzwingt jeder Block ein neues Layout
  for (const s of subs) {
    if (!s.el.isConnected) { subs.delete(s); continue; }
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -vh * .5 || r.top > vh * 1.5) continue;
    live.push([s, r]);
  }
  for (const [s, r] of live) { try { s.fn(r, vh); } catch (e) { console.error('[scrollhub]', e); } }
};
export const kick = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
export function track(el, fn) {
  subs.add({ el, fn });
  if (!bound) { bound = true; addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick, { passive: true }); }
  kick(); requestAnimationFrame(kick); setTimeout(() => initSnapStop(), 0);
}
export const still = () => prefersReducedMotion();
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Fortschritt (0–1) durch eine hohe Scroll-Strecke mit klebender Bühne.
export const trackProgress = (r, stageH) => clamp(-r.top / Math.max(1, r.height - stageH));

// Handy: beim Scroll-Stopp den restlichen Schwung (Auslaufen des Wischens) entfernen und für ms den Scroll sperren – z. B. solange eine zeitgesteuerte Animation läuft.
// So rauscht man nicht an Abschnitten vorbei und die Animation landet immer im perfekten Bild. Am Computer (Maus) passiert nichts.
let holdT = 0, held = false;
const coarse = () => matchMedia('(pointer: coarse)').matches;
// WICHTIG: Der Scroll wird NICHT mehr über overflow:hidden auf <html>/<body> gesperrt. Das machte <body> zu einem eigenen Scroll-Container,
// dadurch lösten sich alle klebenden (sticky) Bühnen vom Bildschirm – genau der Fehler bei „Try it yourself“ am Handy.
// Stattdessen werden Wisch- und Rad-Eingaben abgefangen, solange die Sperre aktiv ist.
const stopMove = (e) => { if (e.cancelable) e.preventDefault(); };
export function releaseScroll() {
  clearTimeout(holdT); if (!held) return; held = false;
  removeEventListener('touchmove', stopMove, { passive: false, capture: true }); removeEventListener('wheel', stopMove, { passive: false, capture: true });
  document.documentElement.style.overscrollBehavior = '';
}
export function holdScroll(ms = 200) {
  if (!coarse() || ms <= 0) return;
  if (!held) { held = true; addEventListener('touchmove', stopMove, { passive: false, capture: true }); addEventListener('wheel', stopMove, { passive: false, capture: true }); document.documentElement.style.overscrollBehavior = 'none'; window.scrollTo(0, window.scrollY); }
  clearTimeout(holdT); holdT = setTimeout(releaseScroll, Math.min(9000, ms));
}

/* ---------- Handy: Anhalten an Abschnitten und Hero-Karten ----------
   Grundregel: EIN Wisch geht höchstens bis zum nächsten Anhaltepunkt (Abschnittsanfang oder Hero-Karte).
   - Android/Chrome: Der Schwung wird schon im Auslaufen am Punkt gestoppt ("Bremse").
   - iOS/Safari und alles andere: JS kann den Schwung dort nicht sicher abbrechen. Deshalb wird NACH dem Auslaufen geprüft,
     welchen Punkt der Wisch überfahren hat – und es gleitet zu GENAU diesem Punkt zurück (nicht zum übernächsten).
   - Kein Anhaltepunkt überfahren: leichter Wisch bleibt wo er ist, kräftiger Wisch kurz vor dem nächsten Punkt rastet dort ein.
   - Die Hero-Animation läuft nach dem Loslassen immer bis zur nächsten Karte zu Ende. */
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let pinY = null, pinUntil = 0, pinMax = 0, samples = [], snapOn = false, snapWhy = 'nicht gestartet', lastY = 0, fingers = 0, snapping = false, gestY = 0, gestT = 0, relY = 0, flickG = false, touched = false, dirLast = 1, glideRaf = 0;
const stat = { brake: 0, settle: 0, back: 0, strong: 0, glide: 0, last: '-' };
const stopFns = [];
// Abschnitte können eigene Anhaltepunkte melden (absolute Scroll-Positionen). settle: Läuft eine Animation zwischen zwei Punkten, wird sie nach dem Loslassen zu Ende geführt.
export function registerStops(fn, settle = false) { const z = { fn, settle }; stopFns.push(z); return () => { const i = stopFns.indexOf(z); if (i >= 0) stopFns.splice(i, 1); }; }
function extraStops() { const o = []; for (const z of stopFns) { try { for (const v of z.fn() || []) o.push(Math.round(v)); } catch { /* weg */ } } return o; }
const isHome = () => !!document.querySelector('.page[data-page="home"]');
function snapTargets() {
  const out = [...extraStops()];
  if (isHome()) for (const b of document.querySelectorAll('.page[data-page="home"] > [data-bi]')) out.push(Math.round(b.getBoundingClientRect().top + scrollY));
  out.sort((a, b) => a - b);
  // Punkte, die fast aufeinander liegen (z. B. kleine Kapitel-Überschrift direkt vor dem Abschnitt), zählen als einer – der erste gilt
  const min = innerHeight * .15, res = [];
  for (const v of out) if (!res.length || v - res[res.length - 1] > min) res.push(v);
  return res;
}
const nextStop = (from, dir, list) => dir > 0 ? list.find((v) => v > from + 6) : [...list].reverse().find((v) => v < from - 6);
// eigenes sanftes Gleiten (überall gleich, unabhängig davon, ob der Browser "smooth" kann; Berührung bricht es ab)
function glide(top) {
  cancelAnimationFrame(glideRaf);
  const y0 = scrollY, dist = top - y0; if (Math.abs(dist) < 2) { snapping = false; return; }
  snapping = true; stat.glide++;
  const dur = clamp(230 + Math.abs(dist) * .42, 230, 640), t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    window.scrollTo(0, y0 + dist * e);
    if (t < 1 && snapping) glideRaf = requestAnimationFrame(step); else { snapping = false; lastY = scrollY; touched = false; }
  };
  glideRaf = requestAnimationFrame(step);
}
// Wisch-Übernahme: Beim Loslassen mit Schwung übernimmt das Skript das Auslaufen selbst (der Browser-Schwung wird abgebrochen), rechnet das Ziel aus –
// höchstens bis zum NÄCHSTEN Haltepunkt – und bremst weich (schnell → langsam) dorthin. Erst der nächste Wisch geht weiter.
function flingTo(target, v0) {
  cancelAnimationFrame(glideRaf);
  const y0 = scrollY, dist = target - y0; if (Math.abs(dist) < 2) { snapping = false; return; }
  snapping = true; stat.glide++;
  const sg = dist > 0 ? 1 : -1, ad = Math.abs(dist), D = clamp(2 * ad / Math.max(Math.abs(v0), .8), 420, 1050), m0 = (v0 * sg < 0 || v0 === 0 ? 0 : sg * Math.min(Math.abs(v0), 2.9 * ad / D)), t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / D), t2 = t * t, t3 = t2 * t;
    const y = y0 + (2 * t3 - 3 * t2 + 1) * 0 + (t3 - 2 * t2 + t) * D * m0 + (-2 * t3 + 3 * t2) * dist;   // Hermite: Start mit Fingergeschwindigkeit, Ende bei 0
    window.scrollTo(0, y);
    if (t < 1 && snapping) glideRaf = requestAnimationFrame(step); else { if (t >= 1) { const n = performance.now(); pinY = target; pinUntil = n + 500; pinMax = n + 5000; } snapping = false; lastY = scrollY; touched = false; }   // danach noch kurz festhalten, falls der Browser-Schwung weiterschiebt
  };
  glideRaf = requestAnimationFrame(step);
}
function takeOver(sv) {
  const y = scrollY, vh = innerHeight, dir = sv > 0 ? 1 : -1, v0 = Math.abs(sv), max = document.documentElement.scrollHeight - vh;
  let target = null, why = '';
  for (const z of stopFns) {
    if (!z.settle) continue; let st; try { st = (z.fn() || []).map(Math.round).sort((a, b) => a - b); } catch { continue; } if (st.length < 2) continue;
    if (y < st[0] - 4 || y > st[st.length - 1] + 4) continue;
    const t = nextStop(gestY, dir, st) ?? nextStop(y, dir, st); if (t != null) { target = t; why = 'hero'; } break;   // gestY = wo der Wisch begann: ein Wisch geht nur bis zur NÄCHSTEN Karte
  }
  if (target == null) {
    const list = snapTargets(), s1 = nextStop(gestY, dir, list), dest = y + dir * Math.min(vh * 3, v0 * 380);
    if (s1 != null && (dir * (y - s1) >= -6 || dir * (dest - s1) >= -vh * .15)) { target = s1; why = 'block'; } else { target = Math.max(0, Math.min(max, dest)); why = 'frei'; }
  }
  stat.strong++; stat.last = `${why} ${Math.round(y)}→${Math.round(target)} v${v0.toFixed(2)}`;
  touched = false; flingTo(target, sv);
}
export function snapInfo() {
  let list = []; try { list = snapTargets(); } catch { /* weg */ }
  return { on: snapOn, why: snapWhy, coarse: coarse(), ios: IOS, y: Math.round(scrollY), vh: innerHeight, fingers, touched, snapping, held, dir: dirLast, gestY: Math.round(gestY), flick: flickG, relY: Math.round(relY), stops: list.length, list: list.slice(0, 12).join(','), ...stat };
}
export function initSnapStop() {
  if (snapOn) return;
  if (!coarse()) { snapWhy = 'kein Touch (pointer: coarse = false)'; return; }
  if (prefersReducedMotion()) { snapWhy = 'Bewegung reduzieren ist am Gerät an'; return; }
  snapOn = true; snapWhy = 'ok'; lastY = scrollY;
  addEventListener('touchstart', (e) => { fingers = e.touches.length; touched = true; pinY = null; if (snapping) { snapping = false; cancelAnimationFrame(glideRaf); } if (fingers === 1) { gestY = scrollY; gestT = performance.now(); samples = []; } }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) { samples.push([t.clientY, performance.now()]); if (samples.length > 8) samples.shift(); } }, { passive: true });
  addEventListener('touchend', (e) => {
    fingers = e.touches.length;
    if (!fingers) {
      relY = scrollY; const now = performance.now(), last = samples[samples.length - 1], old = samples.find((q) => last && last[1] - q[1] <= 120);
      // Fingergeschwindigkeit beim Loslassen: schneller Wisch (Flick) = Schwung folgt
      const v = last && old && last[1] > old[1] && now - last[1] < 120 ? Math.abs(last[0] - old[0]) / (last[1] - old[1]) : 0; flickG = v > .6; stat.v = Math.round(v * 100) / 100;
      if (v >= .25 && !held && isHome()) { const sv = last[0] < old[0] ? v : -v; takeOver(sv); }   // Finger geht hoch (Inhalt nach oben): Scroll nach unten
    }
  }, { passive: true });
  addEventListener('touchcancel', () => { fingers = 0; relY = scrollY; flickG = false; }, { passive: true });
  let settleT = 0;
  const settle = () => {
    if (fingers || snapping || held || !touched) return;
    const y = scrollY, vh = innerHeight, from = flickG ? gestY : relY, dir = Math.abs(y - from) > 6 ? (y > from ? 1 : -1) : dirLast;   // Kurzer Wisch (Flick): zählt ab Berührungsbeginn, damit auch ein Anhaltepunkt anhält, den der Finger selbst schon überfahren hat
    touched = false;
    // 1) Hero (Animation zwischen Punkten): immer zum nächsten Punkt in Wischrichtung zu Ende laufen
    for (const z of stopFns) {
      if (!z.settle) continue; let st; try { st = (z.fn() || []).map(Math.round).sort((a, b) => a - b); } catch { continue; } if (st.length < 2) continue;
      if (y < st[0] - 4 || y > st[st.length - 1] + 4) continue; if (st.some((v) => Math.abs(v - y) <= 6)) return;
      const t = nextStop(from, dir, st) ?? nextStop(y, dir, st); if (t == null || Math.abs(t - y) > vh * 2.2) return;
      stat.settle++; stat.last = `hero ${Math.round(y)}→${t}`; glide(t); return;
    }
    if (!isHome()) return;
    // 2) Abschnittsanfänge: Wurde der nächste Anfang überfahren → genau dorthin zurück/hin. Sonst nur bei kräftigem Wisch kurz davor einrasten.
    const list = snapTargets(), s1 = nextStop(from, dir, list); if (s1 == null) return;
    const passed = dir > 0 ? y >= s1 - 6 : y <= s1 + 6;
    if (passed) { if (Math.abs(y - s1) > 2 && Math.abs(y - s1) <= vh * 1.6) { stat.back++; stat.last = `block ${Math.round(y)}→${s1}`; glide(s1); } return; }
    if (Math.abs(y - gestY) >= vh * .45 && Math.abs(s1 - y) < vh * .5) { stat.strong++; stat.last = `kräftig ${Math.round(y)}→${s1}`; glide(s1); }
  };
  addEventListener('scroll', () => {
    if (pinY != null) { if (!fingers && performance.now() < pinUntil) { if (Math.abs(scrollY - pinY) > 1) { window.scrollTo(0, pinY); pinUntil = Math.min(pinMax, performance.now() + 350); } } else pinY = null; }
    const y = scrollY, d = y - lastY; lastY = y; if (Math.abs(d) > 0) dirLast = d > 0 ? 1 : -1;
    clearTimeout(settleT); settleT = setTimeout(settle, 170);
  }, { passive: true });
}
