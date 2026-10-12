// Text "entschlüsseln": Zeichen laufen von links nach rechts in den echten Text ein (Terminal-/Decrypt-Look).
const CHARS = '01<>/\\_-+=*#$%&';
const jobs = new WeakMap();

export function scramble(el, { duration = 650, delay = 0 } = {}) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const final = el.dataset.scrambleText ?? (el.dataset.scrambleText = el.textContent);
  if (jobs.has(el)) cancelAnimationFrame(jobs.get(el));
  const n = final.length;
  const t0 = performance.now() + delay;
  const tick = (now) => {
    const t = (now - t0) / duration;
    if (t < 0) { jobs.set(el, requestAnimationFrame(tick)); return; }
    if (t >= 1) { el.textContent = final; jobs.delete(el); return; }
    const done = Math.floor(t * n);
    let s = '';
    for (let i = 0; i < n; i++) { const c = final[i]; s += (i < done || c === ' ') ? c : CHARS[(Math.random() * CHARS.length) | 0]; }
    el.textContent = s;
    jobs.set(el, requestAnimationFrame(tick));
  };
  jobs.set(el, requestAnimationFrame(tick));
}
