// BLOCK-REGISTRY
// Neuen Block hinzufügen = Datei in assets/js/blocks/ anlegen + hier eine Zeile ergänzen.
// Jeder Block exportiert { type, label, fields, render(props, ctx) } – das Admin-Backend
// liest `fields`, um automatisch das passende Formular zu bauen.
import { localize, getLang } from './i18n.js';
import spacer from '../blocks/spacer.js';
import heading from '../blocks/heading.js';
import text from '../blocks/text.js';
import media from '../blocks/media.js';
import mediaStack from '../blocks/mediaStack.js';
import projectGrid from '../blocks/projectGrid.js';
import contactForm from '../blocks/contactForm.js';
import socials from '../blocks/socials.js';
import impressum from '../blocks/impressum.js';
import chapter from '../blocks/chapter.js';
import statement from '../blocks/statement.js';
import services from '../blocks/services.js';
import hero from '../blocks/hero.js';
import device from '../blocks/device.js';
import flythrough from '../blocks/flythrough.js';
import kinetic from '../blocks/kinetic.js';
import notuaFlight from '../blocks/notuaFlight.js';
import notuaBoard from '../blocks/notuaBoard.js';
import notuaTeaser from '../blocks/notuaTeaser.js';
import deviceSwitch from '../blocks/deviceSwitch.js';
import projectHead from '../blocks/projectHead.js';
import projectText from '../blocks/projectText.js';
import projectNext from '../blocks/projectNext.js';
import reelGallery from '../blocks/reelGallery.js';
import albumRail from '../blocks/albumRail.js';
import phone3d from '../blocks/phone3d.js';
import elasticReel from '../blocks/elasticReel.js';
import parallaxCarousel from '../blocks/parallaxCarousel.js';
import spinShutter from '../blocks/spinShutter.js';
import frameScrub from '../blocks/frameScrub.js';
import timelinePlayer from '../blocks/timelinePlayer.js';
import galleryBlocks from '../blocks/gallery.js';
import laptop3d from '../blocks/laptop3d.js';
import videoWall from '../blocks/videoWall.js';

export const blocks = [hero, chapter, statement, services, device, flythrough, notuaTeaser, notuaFlight, notuaBoard, deviceSwitch, projectHead, projectText, projectNext, kinetic, spacer, heading, text, media, mediaStack, projectGrid, contactForm, socials, impressum, reelGallery, albumRail, phone3d, laptop3d, elasticReel, parallaxCarousel, spinShutter, frameScrub, timelinePlayer, ...galleryBlocks, videoWall];

// Globaler Textgrößen-Regler: jeder Block mit Text bekommt einen Schieber „Textgröße“ (zoomt nur die Textelemente).
const NO_TEXT = new Set(['spacer', 'media', 'mediaStack', 'reelGallery', 'frameScrub']);
for (const b of blocks) if (!NO_TEXT.has(b.type) && !(b.fields || []).some(f => f.name === 'textScale')) (b.fields ??= []).push(
  { name: 'textScale', label: '🔠 Textgröße am Computer (Schieber, 1 = normal)', type: 'range', min: .5, max: 3, step: .05, default: 1 },
  { name: 'textScaleMobile', label: '📱 Textgröße am Handy (Schieber, 0 = wie am Computer, sonst 1 = normal)', type: 'range', min: 0, max: 3, step: .05, default: 0 });
const TEXT_SEL = 'h1,h2,h3,h4,h5,p,blockquote,li,figcaption,.dv__link';
const mqM = matchMedia('(max-width: 899px)'), scaled = new Set();
const useScale = (e) => { const m = mqM.matches && e.mob > 0 ? e.mob : e.pc; return m > 0 && Math.abs(m - 1) >= .01 ? String(m) : ''; };
mqM.addEventListener('change', () => { for (const e of scaled) { if (!e.el.isConnected && Date.now() - e.t > 5000) { scaled.delete(e); continue; } const z = useScale(e); for (const n of e.nodes) n.style.zoom = z; } });
function applyTextScale(el, pc, mob) {
  pc = Number(pc) || 1; mob = Number(mob) || 0;
  if (!el || el.nodeType !== 1 || (Math.abs(pc - 1) < .01 && mob <= 0)) return;
  const all = [...el.querySelectorAll(TEXT_SEL)]; if (el.matches(TEXT_SEL)) all.unshift(el);
  const set = new Set(all), nodes = [];
  for (const n of all) { let a = n.parentElement, nested = false; while (a && a !== el.parentElement) { if (set.has(a)) { nested = true; break; } a = a.parentElement; } if (!nested) nodes.push(n); }
  const e = { el, nodes, pc, mob, t: Date.now() }; scaled.add(e); const z = useScale(e); for (const n of nodes) n.style.zoom = z;
}

const byType = new Map(blocks.map(b => [b.type, b]));
export const getBlock = (type) => byType.get(type);

export function renderBlocks(list = [], ctx) {
  const frag = document.createDocumentFragment();
  for (const [bi, item] of list.entries()) {
    if (item.hidden) continue;
    const def = byType.get(item.type);
    if (!def) { console.warn(`[blocks] unbekannter Block-Typ: ${item.type}`); continue; }
    try {
      const props = localize(item.props || {});
      if (getLang() === 'de') for (const f of def.fields || []) if (f.de !== undefined && props[f.name] === undefined) props[f.name] = f.de;
      const el = def.render({ ...props, id: item.id }, ctx);
      if (el) { if (el.nodeType === 1) { el.dataset.bi = String(bi); applyTextScale(el, props.textScale, props.textScaleMobile); } frag.append(el); }
    } catch (err) {
      console.error(`[blocks] Fehler in "${item.type}"`, err);
    }
  }
  return frag;
}
