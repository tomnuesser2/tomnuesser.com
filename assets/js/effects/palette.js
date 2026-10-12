// Command-Palette (⌘K / Strg+K): schnell zu Seiten und Projekten springen – wie im Code-Editor.
import { h } from '../core/dom.js';
import { ui } from '../core/i18n.js';

export default {
  name: 'palette',
  init(ctx) {
    const { site: _s } = ctx; let items = [];
    const build = () => { const { site, index } = ctx; items = [
      ...(site.nav || []).map(n => ({ label: n.label, hint: 'menu', href: n.href })),
      ...(index.order || []).filter(s => index.projects?.[s] && !index.projects[s].hidden).map(s => ({ label: String(index.projects[s].title || s).replace(/\n/g, ' '), hint: 'project', href: s })),
    ]; };
    let box, input, list, sel = 0, shown = [];
    const close = () => { box?.remove(); box = null; document.body.classList.remove('is-locked'); };
    const go = (it) => { close(); window.dispatchEvent(new CustomEvent('app:navigate', { detail: { href: it.href } })); };
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      shown = items.filter(i => !q || i.label.toLowerCase().includes(q) || i.hint.includes(q));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map((it, i) => h('li', { class: i === sel ? 'on' : '', onclick: () => go(it) }, h('span', {}, it.label), h('em', {}, it.hint))));
      if (!shown.length) list.append(h('li', { class: 'none' }, ui('noResults')));
    };
    const open = () => {
      if (box) return; build();
      input = h('input', { type: 'text', placeholder: ui('goTo'), 'aria-label': ui('palette'), autocomplete: 'off', spellcheck: 'false' });
      list = h('ul', { role: 'listbox' });
      box = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': ui('palette'), onclick: (e) => { if (e.target === box) close(); } },
        h('div', { class: 'palette__in' }, h('div', { class: 'palette__row' }, h('span', {}, '>'), input), list, h('p', {}, '↑↓ select · enter open · esc close')));
      document.body.append(box); document.body.classList.add('is-locked'); sel = 0; draw(); input.focus();
      input.addEventListener('input', () => { sel = 0; draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
        else if (e.key === 'Enter' && shown[sel]) go(shown[sel]);
        else if (e.key === 'Escape') close();
      });
    };
    addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box ? close() : open(); } });
    window.addEventListener('app:palette', open);
    return true;
  },
};
