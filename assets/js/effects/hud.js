// Kamera-Sucher: laufender Timecode (Tageszeit, 24 fps) in allen HUDs + feste REC-Leiste mit Scroll-Prozent.
import { timecode } from '../core/hud.js';

const visible = new Set();
let bar, tcEl, pctEl, chEl, chapters = [], lastKey = '';

function tick() {
  const d = new Date();
  const tc = timecode(d);
  if (tc !== lastKey) {
    lastKey = tc;
    if (tcEl) tcEl.textContent = tc;
    for (const el of visible) el.textContent = tc;
  }
  requestAnimationFrame(tick);
}
function chapter() {
  let cur = '';
  for (const c of chapters) { if (c.el.getBoundingClientRect().top < innerHeight * .5) cur = `${c.num} / ${c.label}`; }
  if (chEl && chEl.textContent !== cur) chEl.textContent = cur;
}
function pct() {
  chapter();
  const m = document.documentElement.scrollHeight - innerHeight;
  pctEl.textContent = `${String(Math.round(m > 0 ? Math.min(1, scrollY / m) * 100 : 0)).padStart(3, '0')}%`;
}

export default {
  name: 'hud',
  init() {
    bar = document.createElement('div');
    bar.className = 'hud-bar'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="hud-bar__l"><i></i><b>REC</b> <b class="tc">00:00:00:00</b></span><span class="hud-bar__c"></span><span class="hud-bar__r">000%</span>';
    document.body.append(bar);
    tcEl = bar.querySelector('.tc'); pctEl = bar.querySelector('.hud-bar__r'); chEl = bar.querySelector('.hud-bar__c');
    addEventListener('scroll', pct, { passive: true }); pct();
    requestAnimationFrame(tick);
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) { const t = e.target.querySelector('.hud__tc'); if (!t) continue; e.isIntersecting ? visible.add(t) : visible.delete(t); }
    }, { rootMargin: '100px' });
    return true;
  },
  onPage(root) {
    visible.clear();
    chapters = [...root.querySelectorAll('[data-chapter]')].map(el => ({ el, num: el.dataset.num || '', label: el.dataset.chapter || '' }));
    root.querySelectorAll('.hud').forEach(el => this.io.observe(el));
    setTimeout(pct, 60);
  },
};
