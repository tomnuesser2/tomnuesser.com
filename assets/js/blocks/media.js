import { h } from '../core/dom.js';
import { mediaEl } from '../core/media.js';

export const mediaFields = [
  { name: 'vimeo', label: 'Video-Link (Vimeo oder YouTube – einfach die Adresse einfügen, optional)', type: 'text', default: '' },
  { name: 'src', label: 'Bild / Vorschaubild', type: 'image', default: '' },
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
  fields: mediaFields,
  render(p) {
    return h('div', { class: 'b-stack-wrap' }, mediaEl(p));
  },
};
