// Frame-Wächter: Misst die echte Bildrate und hält die Seite flüssig (Ziel: 60 fps), indem er bei Bedarf automatisch schont – ohne dass es groß anders aussieht.
//   Stufe 1: WebGL-Flächen (3D-Flug) rendern etwas weniger Pixel (Q.scale 1 → 0.6), das fällt bei bewegten Bildern kaum auf.
//   Stufe 2: teure Schatten/Weichzeichner/Körnung werden vereinfacht (html[data-fx="lite"], siehe lite.css).
// Läuft die Seite wieder dauerhaft flüssig, geht es Stück für Stück zurück. Mit ?fx=full bleibt immer alles an, mit ?fx=lite immer die Sparstufe.
export const Q = { scale: 1, lite: false, fps: 60, level: 0 };
const subs = new Set(); export const onQuality = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const force = new URLSearchParams(location.search).get('fx');
const set = (scale, lite) => { if (scale === Q.scale && lite === Q.lite) return; Q.scale = scale; Q.lite = lite; document.documentElement.dataset.fx = lite ? 'lite' : 'full'; for (const f of subs) try { f(Q); } catch { /* egal */ } };
if (force === 'lite') set(.7, true);
else if (force !== 'full') {
  let last = performance.now(), n = 0, slow = 0, sum = 0, good = 0, hold = 0;
  const tick = (now) => {
    const dt = now - last; last = now;
    if (dt < 250 && !document.hidden) { n++; sum += dt; if (dt > 24) slow++; }   // sehr lange Lücken (Tab im Hintergrund) zählen nicht
    if (n >= 50) {
      const avg = sum / n; Q.fps = Math.round(1000 / avg); const share = slow / n;
      if (hold > 0) hold--;
      if (share > .35 && hold === 0) { good = 0; hold = 2; if (Q.scale > .62) set(Math.max(.6, +(Q.scale * .85).toFixed(2)), Q.lite); else set(Q.scale, true); }
      else if (share < .06 && avg < 18.5) { if (++good >= 8 && Q.scale < 1 && hold === 0) { good = 0; set(Math.min(1, +(Q.scale + .1).toFixed(2)), Q.lite && Q.scale >= .95 ? false : Q.lite); } }
      else good = 0;
      n = slow = sum = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
