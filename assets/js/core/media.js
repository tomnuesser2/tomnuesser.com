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
// Handy-Ansicht (unter 900 px): jedes Vorschaubild kann eine eigene Smartphone-Variante haben (imageMobile / srcMobile)
export const mobileView = () => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
export const imgFor = (o, k = 'image') => (mobileView() && o && o[k + 'Mobile'] ? o[k + 'Mobile'] : o && o[k]);
export const isEmbedUrl = (s) => /(?:vimeo\.com|youtu\.be|youtube\.com)\//i.test(s || '');
export function parseVimeo(input) {
  if (!input || parseYouTube(input)) return null;
  const m = String(input).match(/(?:vimeo\.com\/(?:video\/)?)?(\d{6,})(?:\/([a-z0-9]+))?/i);
  return m ? { id: m[1], hash: m[2] || '' } : null;
}

const thumbCache = new Map();
// Fragt Vimeo einmal pro Video nach Vorschaubild, Titel und Seitenverhältnis (hoch/quer). Das Ergebnis wird gemerkt.
export async function vimeoInfo(v) {
  if (v.yt) return { thumb: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, title: '', width: 16, height: 9 };
  const key = v.id + v.hash;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const p = (async () => {
    try {
      const url = `https://vimeo.com/${v.id}${v.hash ? '/' + v.hash : ''}`;
      const r = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(url)}`);
      if (!r.ok) return null;
      const j = await r.json();
      const thumb = (j.thumbnail_url || '').replace(/_\d+(x\d+)?(\.\w+)?$/, '_1280$2') || j.thumbnail_url || null;
      return { thumb, title: j.title || '', width: Number(j.width) || 0, height: Number(j.height) || 0 };
    } catch { return null; }
  })();
  thumbCache.set(key, p);
  return p;
}
export async function vimeoThumb(v) { const i = await vimeoInfo(v); return i ? i.thumb : null; }
// hoch = 9:16 (Handy), quer = 16:9 (Laptop); ohne Angabe von Vimeo gilt quer
export const vimeoIsPortrait = (info) => !!(info && info.width && info.height && info.height > info.width);

// Ton-Einstellung der Besucher-Seite (kommt aus content/site.json → video; im Admin unter „Einstellungen“)
export const videoCfg = { volume: 40, button: true };
const SND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path class="on" d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.600 8.600 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="off" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

/**
 * Ein Medium (Bild oder Vimeo-Video).
 * props: { src, alt, vimeo, poster ("auto" | Pfad), ratio, radius: sm|xl|none, parallax, reveal }
 */
export function mediaEl(p = {}) {
  if (p.srcMobile && mobileView()) p = { ...p, src: p.srcMobile };
  if (!p.vimeo && isEmbedUrl(p.src)) p = { ...p, vimeo: p.src, src: '' };
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
    // nur das Vorschaubild tauschen – ein schon geladenes Video (iframe) bleibt drin (sonst löschte ein spät geladenes Vimeo-Vorschaubild das Video)
    inner.querySelectorAll(':scope > img, :scope > .ph').forEach(n => n.remove()); inner.prepend(h('img', { src, alt: p.alt || '', loading: 'lazy', decoding: 'async' }));
  };

  if (posterSrc) setImage(posterSrc); else inner.append(placeholder());

  if (v) {
    if (!posterSrc && p.poster === 'auto') vimeoThumb(v).then(t => { if (t) setImage(t); });
    // Kein Play-Button: das Video startet von selbst, läuft in Dauerschleife, zunächst ohne Ton.
    // Besucher können den Ton per Knopf an/aus schalten – die Lautstärke ist fest (Admin → Einstellungen → Video-Ton).
    const canSnd = p.sound !== false && videoCfg.button !== false && Number(videoCfg.volume) > 0;
    const q = new URLSearchParams(v.yt ? { autoplay: '1', mute: '1', loop: '1', playlist: v.id, controls: '0', rel: '0', playsinline: '1', modestbranding: '1', disablekb: '1', iv_load_policy: '3', enablejsapi: '1' }
      : { ...(canSnd || p.ext || p.viewPlay ? { controls: '0', api: '1' } : { background: '1' }), autoplay: '1', loop: '1', muted: '1', autopause: '0', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1' });
    // viewPlay: erst abspielen, wenn das Video gut zu sehen ist (nicht schon beim Vorladen) – von vorn, ohne Autostart
    if (p.viewPlay) q.set('autoplay', '0');
    if (v.hash) q.set('h', v.hash);
    let started = false, ifr = null, on = false;
    const send = (o) => { try { ifr.contentWindow.postMessage(v.yt ? JSON.stringify(o) : JSON.stringify(o), v.yt ? 'https://www.youtube-nocookie.com' : 'https://player.vimeo.com'); } catch { /* weg */ } };
    const setSound = (flag) => {
      on = flag; const vol = Math.max(0, Math.min(100, Number(videoCfg.volume) || 0));
      if (v.yt) { send({ event: 'command', func: 'setVolume', args: [vol] }); send({ event: 'command', func: flag ? 'unMute' : 'mute', args: [] }); }
      else { send({ method: 'setVolume', value: vol / 100 }); send({ method: 'setMuted', value: !flag }); }
      if (snd) { snd.classList.toggle('is-on', flag); snd.setAttribute('aria-pressed', String(flag)); }
    };
    const snd = canSnd ? h('button', { class: 'media-snd', type: 'button', 'aria-label': 'Ton an/aus', 'aria-pressed': 'false' }) : null;
    if (snd) { snd.innerHTML = SND; snd.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setSound(!on); }); frame.append(snd); }
    // Von außen steuerbar (z. B. Lautstärke-Regler im Laptop-Block): frame.tnVol(0–100)
    let wantVol = null;
    const applyVol = () => { if (wantVol == null || !ifr) return; const vol = wantVol;
      if (v.yt) { send({ event: 'command', func: 'setVolume', args: [vol] }); send({ event: 'command', func: vol > 0 ? 'unMute' : 'mute', args: [] }); }
      else { send({ method: 'setVolume', value: vol / 100 }); send({ method: 'setMuted', value: vol <= 0 }); } };
    frame.tnVol = (vol) => { wantVol = Math.max(0, Math.min(100, Number(vol) || 0)); applyVol(); };
    const start = () => {
      if (started) return; started = true;
      ifr = h('iframe', {
        src: v.yt ? `https://www.youtube-nocookie.com/embed/${v.id}?${q}` : `https://player.vimeo.com/video/${v.id}?${q}`, allow: 'autoplay; fullscreen; picture-in-picture', tabindex: '-1', 'aria-hidden': 'true',
        title: p.alt || 'Video', loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin', class: 'media-embed',
      });
      ifr.addEventListener('load', () => { setTimeout(applyVol, 400); setTimeout(applyVol, 1500); if (p.viewPlay) [300, 900, 2000].forEach(ms => setTimeout(applyPlay, ms)); });
      inner.append(ifr);
    };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '200px' }); io.observe(frame); } else start();
    // Abspielen beim Hinscrollen: ab gut der Hälfte sichtbar läuft es (und meldet das, damit z. B. die Reel-Wand darüber pausiert),
    // unter einem Drittel sichtbar → Pause (und die anderen laufen wieder).
    let wantPlay = false;
    let playing = false, retry = 0, tries = 0;
    function applyPlay() { if (!ifr) return; if (v.yt) send({ event: 'command', func: wantPlay ? 'playVideo' : 'pauseVideo', args: [] }); else send({ method: wantPlay ? 'play' : 'pause' });
      // Der Player ist oft noch nicht bereit → so lange nachfassen, bis er wirklich läuft (max. ~20 s)
      clearTimeout(retry); if (!wantPlay) tries = 0; if (wantPlay && !playing && tries++ < 20) retry = setTimeout(() => { if (wantPlay && !playing) { if (!v.yt) send({ method: 'setMuted', value: !on }); applyPlay(); } }, 1000); }
    if (p.viewPlay && !v.yt) addEventListener('message', (e) => {
      if (!ifr || e.source !== ifr.contentWindow) return; let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
      if (!d) return;
      if (d.event === 'ready') { ['play', 'pause', 'playProgress'].forEach(ev => send({ method: 'addEventListener', value: ev })); applyVol(); applyPlay(); }
      else if (d.event === 'play' || d.event === 'playProgress') { playing = true; if (!wantPlay) applyPlay(); }
      else if (d.event === 'pause') { playing = false; if (wantPlay) applyPlay(); }
    });
    if (p.viewPlay && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        const r = e.intersectionRatio;
        if (r >= .55 && !wantPlay) { wantPlay = true; start(); applyPlay(); dispatchEvent(new CustomEvent('tn-video-focus', { detail: frame })); }
        else if (r < .35 && wantPlay) { wantPlay = false; applyPlay(); if (on) setSound(false); dispatchEvent(new CustomEvent('tn-video-blur', { detail: frame })); }
      }), { threshold: [0, .2, .35, .55, .75, 1] }).observe(frame);
    }
  }
  return frame;
}
