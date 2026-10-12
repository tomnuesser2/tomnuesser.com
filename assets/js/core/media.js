import { h, svg } from './dom.js';
import { hudEl } from './hud.js';

function hashHue(str) {
  let x = 0;
  for (const c of String(str || 'x')) x = (x * 31 + c.charCodeAt(0)) % 360;
  return x;
}

// Akzeptiert "123456789", "https://vimeo.com/123456789" oder "https://vimeo.com/123456789/abcdef1234"
export function parseYouTube(input) {
  if (!input) return null;
  const m = String(input).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? { id: m[1] } : null;
}
export function parseVimeo(input) {
  if (!input || parseYouTube(input)) return null;
  const m = String(input).match(/(?:vimeo\.com\/(?:video\/)?)?(\d{6,})(?:\/([a-z0-9]+))?/i);
  return m ? { id: m[1], hash: m[2] || '' } : null;
}

const thumbCache = new Map();
export async function vimeoThumb(v) {
  if (v.yt) return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
  const key = v.id + v.hash;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const p = (async () => {
    try {
      const url = `https://vimeo.com/${v.id}${v.hash ? '/' + v.hash : ''}`;
      const r = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(url)}`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.thumbnail_url || '').replace(/_\d+(x\d+)?(\.\w+)?$/, '_1280$2') || j.thumbnail_url || null;
    } catch { return null; }
  })();
  thumbCache.set(key, p);
  return p;
}

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

/**
 * Ein Medium (Bild oder Vimeo-Video).
 * props: { src, alt, vimeo, poster ("auto" | Pfad), ratio, radius: sm|xl|none, parallax, reveal }
 */
export function mediaEl(p = {}) {
  const radius = p.radius || 'sm';
  const frame = h('figure', {
    class: `media-frame r-${radius}`,
    style: { '--ratio': (p.ratio || '16/9').replace('/', ' / ') },
    'data-reveal': p.reveal === false ? null : 'media',
    'data-parallax': p.parallax === false ? null : '1',
  });
  const inner = h('div', { class: 'media-inner' });
  frame.append(inner);

  const hudOn = p.hud === true || p.hud === 'true', hudOff = p.hud === false || p.hud === 'false';
  if (hudOn || (!hudOff && radius === 'xl')) { frame.dataset.hud = '1'; frame.append(hudEl({ cam: p.cam })); }

  const yt = parseYouTube(p.vimeo), v = yt ? { id: yt.id, yt: true } : parseVimeo(p.vimeo);
  const posterSrc = p.poster && p.poster !== 'auto' ? p.poster : p.src;

  const placeholder = () => h('div', { class: 'ph', style: { '--h1': hashHue(p.vimeo || p.src || p.alt), '--h2': (hashHue(p.vimeo || p.src || p.alt) + 70) % 360 } });
  const setImage = (src) => {
    inner.replaceChildren(h('img', { src, alt: p.alt || '', loading: 'lazy', decoding: 'async' }));
  };

  if (posterSrc) setImage(posterSrc); else inner.append(placeholder());

  if (v) {
    if (!posterSrc && p.poster === 'auto') vimeoThumb(v).then(t => { if (t) setImage(t); });
    const btn = h('button', { class: 'media-play', type: 'button', 'aria-label': `Play video${p.alt ? ': ' + p.alt : ''}`, 'data-cursor': 'play' },
      h('span', { class: 'media-play__dot' }, svg(PLAY)));
    frame.append(btn);
    btn.addEventListener('click', () => {
      const q = new URLSearchParams(v.yt ? { autoplay: '1', rel: '0', playsinline: '1', modestbranding: '1' } : { autoplay: '1', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1' });
      if (v.hash) q.set('h', v.hash);
      const ifr = h('iframe', {
        src: v.yt ? `https://www.youtube-nocookie.com/embed/${v.id}?${q}` : `https://player.vimeo.com/video/${v.id}?${q}`, allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: '',
        title: p.alt || 'Video', loading: 'eager', referrerpolicy: 'strict-origin-when-cross-origin',
      });
      inner.replaceChildren(ifr);
      frame.classList.add('is-playing');
      frame.removeAttribute('data-parallax');
      inner.style.transform = 'none';
    });
  }
  return frame;
}
