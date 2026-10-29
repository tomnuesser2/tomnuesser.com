// Handy-Schonung: Auf kleinen Bildschirmen / Touch-Geräten werden Bilder aus media/ automatisch durch verkleinerte Kopien aus media/_m/ ersetzt
// (1000 px breit, WebP) – das spart Speicher und Dekodierzeit und macht das Scrollen flüssiger. Gibt es keine Kopie, lädt das Original (Fallback bei Fehler).
// Kopien erzeugt tools/mobile-bilder.mjs (oder die Vorschau-Aufbereitung); Originale bleiben unverändert.
const small = () => { try { return matchMedia('(max-width: 899px)').matches || matchMedia('(pointer: coarse)').matches; } catch { return false; } };
if (small() && typeof HTMLImageElement !== 'undefined' && !new URLSearchParams(location.search).has('fullimg')) {
  const re = /^(.*?\bmedia\/)([^\/?#]+)\.(jpe?g|png|webp)(\?.*)?$/i;
  const map = (v) => { const m = re.exec(String(v)); return m && !/\/_/.test(m[1]) ? m[1] + '_m/' + m[2] + '.webp' : null; };
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'), setAttr = Element.prototype.setAttribute;
  const apply = (img, v, set) => {
    const m = map(v);
    if (!m || img.dataset.full) return set(v);
    img.dataset.full = v;
    img.addEventListener('error', function f() { img.removeEventListener('error', f); set(img.dataset.full); }, { once: true });
    set(m);
  };
  if (d && d.set) Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { apply(this, v, (x) => d.set.call(this, x)); } });
  Element.prototype.setAttribute = function (n, v) { if (this instanceof HTMLImageElement && String(n).toLowerCase() === 'src') return apply(this, v, (x) => setAttr.call(this, 'src', x)); return setAttr.call(this, n, v); };
}
export {};
