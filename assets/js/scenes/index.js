// SZENEN-REGISTRY: Jede Variante = eine Datei in diesem Ordner + hier eintragen.
// { name, label, len (Scroll-Länge in svh), light?, build({pr,i,n}) -> Knoten, init?(sc), update(sc, p, {vw,vh}) }
import expand from './expand.js';
import curtain from './curtain.js';
import marquee from './marquee.js';
import stack from './stack.js';
import gallery from './gallery.js';
import iris from './iris.js';
import tilt from './tilt.js';
import pullback from './pullback.js';
import pixel from './pixel.js';
import words from './words.js';

export const variants = { expand, curtain, marquee, stack, gallery, iris, tilt, pullback, pixel, words };
export const names = Object.keys(variants);
export const pick = (name) => variants[name] || variants.expand;
