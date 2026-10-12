// EFFEKT-REGISTRY
// Neuer Effekt = Datei in assets/js/effects/ + hier importieren + in content/site.json unter "effects" an/aus schalten.
// Ein Effekt ist ein Objekt: { name, init(ctx) -> bool, onPage?(root), beforeNavigate?(), afterNavigate?() }
import reveal from './reveal.js';
import splitText from './splitText.js';
import parallax from './parallax.js';
import magnetic from './magnetic.js';
import smoothScroll from './smoothScroll.js';
import grain from './grain.js';
import progress from './progress.js';
import cursor from './cursor.js';
import headerHide from './headerHide.js';
import pageTransition from './pageTransition.js';
import scenes from './scenes.js';
import hud from './hud.js';
import scramble from './scramble.js';
import palette from './palette.js';

export const effects = {
  reveal, splitText, parallax, magnetic, smoothScroll, grain, progress, cursor, headerHide, pageTransition, scenes, hud, scramble, palette,
};

const running = [];

export function startEffects(config = {}, ctx = {}) {
  for (const [key, fx] of Object.entries(effects)) {
    if (config[key] === false) continue;
    try { if (fx.init(ctx) !== false) running.push(fx); } catch (e) { console.error(`[effects] ${key} konnte nicht starten`, e); }
  }
}
export function pageReady(root) { for (const fx of running) { try { fx.onPage?.(root); } catch (e) { console.error(e); } } }
export async function beforeNavigate() { for (const fx of running) { try { await fx.beforeNavigate?.(); } catch (e) { console.error(e); } } }
export async function afterNavigate() { for (const fx of running) { try { await fx.afterNavigate?.(); } catch (e) { console.error(e); } } }
