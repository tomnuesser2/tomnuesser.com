import { h } from '../core/dom.js';
import { mediaEl, isEmbedUrl, videoCfg } from '../core/media.js';
import { track, still, clamp, trackProgress } from '../core/scrollhub.js';
// Device: Smartphone (Hochformat-Videos/Reels, wie Stories) oder Laptop (Websites, scrollen im Bildschirm) neben Text.
// Beim Scrollen klebt die Bühne fest: Das Gerät schaltet durch die Einträge, der Text daneben wechselt mit.
const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s || '');
const media = (src) => isEmbedUrl(src)
  ? mediaEl({ vimeo: src, ratio: '1/1', radius: 'none', reveal: false, parallax: false, sound: false, hud: false, ext: true })
  : isVideo(src)
  ? h('video', { src, muted: true, loop: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true' })
  : h('img', { src, alt: '', decoding: 'async', loading: 'lazy' });

export default {
  type: 'device', label: 'Gerät (Smartphone / Laptop mit Text)',
  fields: [
    { name: 'kind', label: 'Gerät', type: 'select', options: ['phone', 'laptop'], default: 'phone' },
    { name: 'side', label: 'Gerät steht', type: 'select', options: ['left', 'right'], default: 'left' },
    { name: 'textAlign', label: 'Text-Versatz neben dem Gerät', type: 'select', options: ['links', 'mitte', 'rechts'], default: 'links' },
    { name: 'kicker', label: 'Kleine Zeile (z. B. short-form / web)', type: 'text', default: '' },
    { name: 'title', label: 'Überschrift', type: 'text', default: '' },
    { name: 'text', label: 'Text unter der Überschrift', type: 'textarea', default: '' },
    { name: 'items', label: 'Einträge (Bild, .mp4 oder Vimeo/YouTube-Link; beim Laptop hohe Website-Screenshots)', type: 'list', itemFields: [
      { name: 'src', label: 'Bild oder Video (Datei oder Vimeo-/YouTube-Link)', type: 'image' }, { name: 'title', label: 'Titel (steht neben dem Gerät)', type: 'text' }, { name: 'url', label: 'Text in der Adresszeile oben (leer = Titel; bei „Adresszeile anzeigen“ aus unsichtbar)', type: 'text' }, { name: 'text', label: 'Kurztext', type: 'textarea' }] },
    { name: 'chrome', label: '💻 Laptop: Adresszeile oben anzeigen (Punkte + Text)', type: 'checkbox', default: true },
    { name: 'chromeMobile', label: '📱 Auf dem Handy des Besuchers: Adresszeile anzeigen', type: 'checkbox', default: true },
    { name: 'volumeUi', label: '🔊 Lautstärke-Regler einblenden (Besucher kann Ton an/aus und Lautstärke wählen)', type: 'checkbox', default: false },
    { name: 'linkText', label: 'Link-Text (optional)', type: 'text', default: '' },
    { name: 'linkUrl', label: 'Link-Ziel (optional)', type: 'text', default: '' },
  ],
  render(p) {
    const items = (p.items || []).filter(i => i.src);
    const n = Math.max(1, items.length), phone = p.kind !== 'laptop';
    const screens = items.map((it) => h('div', { class: 'dv__scr' }, media(it.src)));
    let device;
    if (phone) {
      const bars = items.map(() => h('i', {}, h('b', {})));
      device = h('div', { class: 'dv__phone' }, h('div', { class: 'dv__screen' }, h('div', { class: 'dv__bars' }, bars), screens,
        h('button', { class: 'dv__tap dv__tap--l', type: 'button', 'aria-label': 'previous' }), h('button', { class: 'dv__tap dv__tap--r', type: 'button', 'aria-label': 'next' })),
        h('span', { class: 'dv__island' }), h('span', { class: 'dv__home' }));
    } else {
      device = h('div', { class: 'dv__laptop' }, h('div', { class: 'dv__lid' }, h('div', { class: 'dv__screen' },
        h('div', { class: 'dv__chrome' }, h('i', {}), h('i', {}), h('i', {}), h('span', { class: 'dv__url' }, items[0] ? (items[0].url ?? items[0].title ?? '') : '')), h('div', { class: 'dv__page' }, screens))), h('div', { class: 'dv__base' }));
    }
    const copyItem = h('div', { class: 'dv__item' }, h('h3', { class: 'dv__it' }), h('p', { class: 'dv__ix' }));
    const dots = h('div', { class: 'dv__dots' }, items.map((_, i) => h('span', {}, String(i + 1).padStart(2, '0'))));
    const copy = h('div', { class: 'dv__copy' }, p.kicker ? h('p', { class: 'dv__k' }, p.kicker) : null, h('h2', { class: 'dv__h' }, p.title || ''),
      p.text ? h('p', { class: 'dv__p' }, p.text) : null, copyItem, items.length > 1 ? dots : null,
      p.linkText && p.linkUrl ? h('a', { class: 'dv__link', href: p.linkUrl, ...(/^https?:/.test(p.linkUrl) ? { target: '_blank', rel: 'noopener' } : { 'data-link': '' }) }, p.linkText + ' ↗') : null);
    const stage = h('div', { class: 'dv__stage' }, device, copy);
    const el = h('section', { class: `dv dv--${phone ? 'phone' : 'laptop'} dv--${p.side === 'right' ? 'right' : 'left'} dv--ta-${p.textAlign === 'mitte' ? 'center' : p.textAlign === 'rechts' ? 'right' : 'left'}${p.chrome === false ? ' dv--nochrome' : ''}${p.chromeMobile === false ? ' dv--nochrome-m' : ''}${p.volumeUi ? ' dv--vol' : ''}`, id: p.id, style: { '--n': n, '--ts': Number(p.textScale) > 0 ? Number(p.textScale) : 1 } }, h('div', { class: 'dv__track' }, stage));

    // Lautstärke-Regler (optional)
    let vol = 0, lastVol = Math.max(10, Number(videoCfg.volume) || 40), cur = -1;
    const applyVol = () => screens.forEach((sc, k) => {
      const f = sc.querySelector('.media-frame'), v = sc.querySelector('video');
      if (f && f.tnVol) f.tnVol(k === cur ? vol : 0);
      if (v) { v.muted = !(k === cur && vol > 0); v.volume = Math.max(0, Math.min(1, vol / 100)); }
    });
    if (p.volumeUi && screens.some(sc => sc.querySelector('video, .media-frame'))) {
      const rng = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Lautstärke', class: 'dv__rng' });
      const btn = h('button', { type: 'button', class: 'dv__mute', 'aria-label': 'Ton an/aus' });
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path class="on" d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="off" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      const ui = h('div', { class: 'dv__vol', 'data-nodrag': '' }, btn, rng);
      const setV = (v) => { vol = v; if (v > 0) lastVol = v; rng.value = String(v); ui.classList.toggle('is-on', v > 0); applyVol(); };
      rng.addEventListener('input', () => setV(Number(rng.value)));
      btn.addEventListener('click', (e) => { e.stopPropagation(); setV(vol > 0 ? 0 : lastVol); });
      ui.addEventListener('click', (e) => e.stopPropagation());
      el.querySelector('.dv__screen').append(ui);
    }
    const setCur = (i) => {
      if (i === cur) return; cur = i;
      screens.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i); const v = s.querySelector('video'); if (v) { if (k === i) v.play?.().catch(() => {}); else v.pause?.(); } });
      copyItem.classList.remove('is-in'); void copyItem.offsetWidth;
      copyItem.querySelector('.dv__it').textContent = items[i]?.title || ''; copyItem.querySelector('.dv__ix').textContent = items[i]?.text || '';
      copyItem.classList.add('is-in'); dots.childNodes.forEach((d, k) => d.classList.toggle('is-on', k === i));
      const u = el.querySelector('.dv__url'); if (u && items[i]) u.textContent = items[i].url || items[i].title || ''; applyVol();
    };
    setCur(0);
    const go = (i) => { const r = el.querySelector('.dv__track').getBoundingClientRect(); const total = r.height - stage.offsetHeight; const y = scrollY + r.top + ((clamp(i, 0, n - 1) + .5) / n) * total; scrollTo({ top: y, behavior: 'smooth' }); };
    el.addEventListener('click', (e) => { if (e.target.closest('.dv__tap--l')) go(cur - 1); else if (e.target.closest('.dv__tap--r')) go(cur + 1); });
    if (still()) { el.classList.add('is-still'); return el; }
    const bars = [...el.querySelectorAll('.dv__bars b')];
    track(el.querySelector('.dv__track'), (r) => {
      const p0 = trackProgress(r, stage.offsetHeight), f = p0 * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
      setCur(i);
      el.style.setProperty('--p', p0.toFixed(4)); el.style.setProperty('--e', clamp(p0 / .12).toFixed(3));
      bars.forEach((b, k) => { b.style.transform = `scaleX(${k < i ? 1 : k === i ? fr : 0})`; });
      if (!phone) {
        const pg = screens[i]?.querySelector('img'); const page = el.querySelector('.dv__page');
        if (pg && page) { const over = Math.max(0, pg.clientHeight - page.clientHeight); pg.style.transform = `translate3d(0,${(-over * clamp((fr - .08) / .84)).toFixed(1)}px,0)`; }
      }
    });
    return el;
  },
};
