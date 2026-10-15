// Mess-Modus für echte Geräte: Seite mit ?perf öffnen (z. B. tomnuesser.com/?perf).
// Zeigt oben FPS + Ruckler, merkt sich pro Abschnitt, wo es hakt, und liefert unten einen Bericht ("Bericht" antippen → wird kopiert und angezeigt).
// Nichts davon läuft ohne ?perf.
import { snapInfo } from './scrollhub.js';
const R = { ua: navigator.userAgent, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, mem: navigator.deviceMemory || null, cores: navigator.hardwareConcurrency || null, frames: 0, slow: 0, jank: 0, worst: 0, long: 0, longMax: 0, sec: {}, t0: performance.now() };
let last = performance.now(), cur = '-', fpsN = 0, fpsT = last, fps = 0;
const secOf = () => {
  const y = scrollY + innerHeight * .5; let name = '-';
  for (const b of document.querySelectorAll('.page > [data-bi]')) { const r = b.getBoundingClientRect(); if (r.top + scrollY <= y && r.bottom + scrollY > y) { name = (b.dataset.bi || '?') + ':' + (b.className + '').split(' ')[0]; break; } }
  return name + '@' + document.querySelector('.page')?.dataset.page;
};
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:6px;top:6px;right:92px;z-index:99999;font:10px/1.3 ui-monospace,monospace;word-break:break-all;color:#0f0;background:rgba(0,0,0,.78);padding:5px 7px;border-radius:7px;pointer-events:none;white-space:pre';
const btn = document.createElement('button'); btn.textContent = 'Bericht'; btn.style.cssText = 'position:fixed;right:8px;top:8px;z-index:99999;font:600 13px system-ui;padding:8px 12px;border-radius:99px;border:0;background:#ff6a4d;color:#fff';
const out = document.createElement('pre'); out.style.cssText = 'position:fixed;inset:44px 6px 6px 6px;z-index:99998;overflow:auto;margin:0;padding:10px;font:10.5px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.92);border-radius:10px;white-space:pre-wrap;display:none';
document.body.append(hud, btn, out);
const tick = (now) => {
  const dt = now - last; last = now; R.frames++;
  if (dt > 24) { R.slow++; if (dt > 50) R.jank++; }
  if (dt > R.worst) R.worst = dt;
  const s = (R.sec[cur] ||= { f: 0, slow: 0, jank: 0, worst: 0, sum: 0 }); s.f++; s.sum += dt; if (dt > 24) s.slow++; if (dt > 50) s.jank++; if (dt > s.worst) s.worst = Math.round(dt);
  fpsN++; if (now - fpsT > 500) { fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; let sn = ''; try { const s = snapInfo(); sn = `\nSnap ${JSON.stringify(s)}`; R.snap = s; } catch (e) { sn = '\nSnap ' + e; } hud.textContent = `${fps} fps  Ruckler>50ms: ${R.jank}  Spitze ${Math.round(R.worst)}ms\n${cur}\nLongTasks ${R.long} (max ${Math.round(R.longMax)}ms)${sn}`; }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
setInterval(() => { cur = secOf(); }, 150);
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { R.long++; if (e.duration > R.longMax) R.longMax = e.duration; const s = (R.sec[cur] ||= { f: 0, slow: 0, jank: 0, worst: 0, sum: 0 }); s.lt = (s.lt || 0) + 1; s.ltMax = Math.max(s.ltMax || 0, Math.round(e.duration)); } }).observe({ entryTypes: ['longtask'] }); } catch { /* nicht überall */ }
const report = () => {
  const rows = Object.entries(R.sec).filter(([, s]) => s.f > 5).sort((a, b) => b[1].jank - a[1].jank || b[1].slow - a[1].slow)
    .map(([k, s]) => `${k.padEnd(28)} Bilder ${String(s.f).padStart(4)}  Ø ${(s.sum / s.f).toFixed(1)}ms  >24ms ${String(s.slow).padStart(3)}  >50ms ${String(s.jank).padStart(3)}  Spitze ${s.worst}ms  LT ${s.lt || 0}/${s.ltMax || 0}ms`);
  return `SNAP ${JSON.stringify(R.snap || {})}\nNUTZER ${R.ua}\nBildschirm ${R.vw}x${R.vh} @${R.dpr}x  RAM ${R.mem}  Kerne ${R.cores}\nGesamt: ${R.frames} Bilder, >24ms ${R.slow}, >50ms ${R.jank}, Spitze ${Math.round(R.worst)}ms, LongTasks ${R.long}\n\nSCHLECHTESTE ABSCHNITTE (nach Rucklern)\n${rows.join('\n')}`;
};
btn.addEventListener('click', () => { if (out.style.display === 'block') { out.style.display = 'none'; btn.textContent = 'Bericht'; return; } const t = report(); out.textContent = t; out.style.display = 'block'; btn.textContent = 'Schließen'; try { navigator.clipboard.writeText(t).catch(() => {}); } catch { /* egal */ } });
