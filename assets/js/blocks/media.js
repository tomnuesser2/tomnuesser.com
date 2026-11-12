import { h, paragraphs } from '../core/dom.js';
import { mediaEl } from '../core/media.js';

export const mediaFields = [
  { name: 'vimeo', label: 'Video-Link (Vimeo oder YouTube – einfach die Adresse einfügen, optional)', type: 'text', default: '' },
  { name: 'src', label: '💻 Bild / Vorschaubild (Computer)', type: 'image', default: '' },
  { name: 'srcMobile', label: '📱 Bild / Vorschaubild für Smartphone (leer = wie Computer)', type: 'image', default: '' },
  { name: 'poster', label: 'Vorschaubild des Videos automatisch laden ("auto")', type: 'select', options: ['', 'auto'], default: 'auto' },
  { name: 'ratio', label: 'Seitenverhältnis (z. B. 16/9, 4/5, 1/1)', type: 'text', default: '16/9' },
  { name: 'radius', label: 'Rundung', type: 'select', options: ['sm', 'xl', 'none'], default: 'sm' },
  { name: 'alt', label: 'Beschreibung (Alt-Text)', type: 'text', default: '' },
  { name: 'hud', label: 'Kamera-Sucher-Overlay (REC, Timecode) anzeigen', type: 'select', options: ['', 'true', 'false'], default: '' },
  { name: 'cam', label: 'Kamera-Label im Sucher (z. B. FX3)', type: 'text', default: '' },
];

export default {
  type: 'media',
  label: 'Bild / Video (Vimeo oder YouTube)',
  fields: [...mediaFields,
    { name: 'sideTitle', label: '📝 Text neben dem Video – Überschrift (leer + kein Text = Video allein über die ganze Breite)', type: 'text', default: '' },
    { name: 'sideText', label: '📝 Text neben dem Video (Leerzeile = neuer Absatz)', type: 'textarea', default: '' },
    { name: 'sidePos', label: 'Video steht …', type: 'select', options: ['links', 'rechts'], default: 'links' },
  ],
  render(p) {
    const vid = h('div', { class: 'b-stack-wrap' }, mediaEl({ ...p, viewPlay: true }));
    if (!p.sideTitle && !p.sideText) return vid;
    // Video + Text in EINEM Abschnitt: Video groß auf der einen Seite, Text daneben (Handy: untereinander)
    const copy = h('div', { class: 'mt__c' }, p.sideTitle ? h('h2', { class: 'mt__h' }, p.sideTitle) : null, ...paragraphs(p.sideText).map(t => h('p', {}, t)));
    const sec = h('section', { class: `mt${p.sidePos === 'rechts' ? ' mt--r' : ''}`, id: p.id, 'data-reveal': 'up' }, vid, copy);
    // PC: Schriftgröße so anpassen, dass der Text genau so hoch ist wie das Video daneben
    const fit = () => { const fr = vid.firstElementChild; if (!sec.isConnected || !fr) return; if (innerWidth < 900) { copy.style.removeProperty('--mt-k'); return; }
      const target = fr.offsetHeight; if (target < 40) return; let lo = .55, hi = 1.6;
      for (let i = 0; i < 12; i++) { const k = (lo + hi) / 2; copy.style.setProperty('--mt-k', k.toFixed(4)); if (copy.offsetHeight > target) hi = k; else lo = k; }
      copy.style.setProperty('--mt-k', lo.toFixed(4)); };
    if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(fit)).observe(vid); requestAnimationFrame(fit); document.fonts?.ready?.then(fit);
    return sec;   // startet erst, wenn man hinscrollt; andere Videos pausieren dann
  },
};
