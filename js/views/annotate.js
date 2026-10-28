// Map annotation popover (Figma: "Annotation Container States" — empty / filled / saved / edit).
import { state, ui, emit, nextId } from '../store.js';
import { live } from '../sim.js';
import { h, btn, chip, fmtTime, icon } from '../ui.js';

const MAX = 500;
let el = null;

export function closeAnnotation() { el?.remove(); el = null; }

export function openAnnotation(app, { id, x, y }) {
  closeAnnotation();
  const existing = id ? state.annotations.find((a) => a.id === id) : null;
  const a = existing ? structuredClone(existing) : { x, y, text: '', tags: [], ts: Date.now() };
  let mode = existing ? 'saved' : 'edit';
  const flightId = existing?.flightId || live.flightId || ui.selectedFlight || state.flights[0]?.id;
  if (!flightId) return;

  const host = document.getElementById('map');
  el = h('div', { class: 'annot', role: 'dialog', 'aria-label': 'Annotation' });
  host.append(el);

  const place = () => {
    const r = host.getBoundingClientRect();
    const sx = a.x * app.map.view.k + app.map.view.x, sy = a.y * app.map.view.k + app.map.view.y;
    const w = 320, hgt = el.offsetHeight || 420;
    let left = sx + 18, top = sy - hgt / 2;
    if (left + w > r.width - 12) left = sx - w - 18;
    el.style.left = `${Math.max(12, left)}px`;
    el.style.top = `${Math.max(64, Math.min(r.height - hgt - 12, top))}px`;
  };

  const draw = () => {
    const tagIn = h('input', { class: 'input', placeholder: 'Mission Tags', onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); a.tags.push(e.target.value.trim()); draw(); el.querySelector('.tag-in')?.focus(); } } });
    tagIn.classList.add('tag-in');
    const counter = h('span', { class: 'chars' });
    const ta = h('textarea', { class: 'input', rows: 9, maxlength: MAX, placeholder: 'What did you see? e.g. Roof collapse, person signalling, blocked road…', oninput: (e) => { a.text = e.target.value; upd(); } }, a.text);
    const upd = () => { const left = MAX - a.text.length; counter.textContent = `*${left} Characters Left`; counter.classList.toggle('warn', left < 50); save.disabled = !a.text.trim(); };
    const save = btn('Save', { small: true, onClick: () => {
      if (existing) Object.assign(existing, { text: a.text, tags: a.tags, ts: Date.now() });
      else state.annotations.push({ id: nextId('A'), flightId, x: a.x, y: a.y, text: a.text, tags: a.tags, ts: Date.now() });
      closeAnnotation(); emit('annotation');
    } });
    if (mode === 'saved') {
      el.replaceChildren(
        h('div', { class: 'annot-ts' }, fmtTime(existing.ts)),
        h('p', { class: 'annot-text' }, existing.text),
        h('div', { class: 'chips' }, existing.tags.map((t) => chip(t))),
        h('div', { class: 'row-actions right' },
          btn('Delete', { variant: 'dark', small: true, icon: 'delete', onClick: () => { mode = 'confirm'; draw(); } }),
          btn('Close', { variant: 'dark', small: true, onClick: closeAnnotation }),
          btn('Edit', { small: true, icon: 'edit', onClick: () => { mode = 'edit'; draw(); } })));
    } else if (mode === 'confirm') {
      el.replaceChildren(h('p', {}, 'Are you sure? This annotation will be deleted forever.'),
        h('div', { class: 'row-actions right' }, btn('Cancel', { variant: 'dark', small: true, onClick: () => { mode = 'saved'; draw(); } }),
          btn('Delete', { variant: 'danger', small: true, onClick: () => { state.annotations = state.annotations.filter((x) => x.id !== existing.id); closeAnnotation(); emit('annotation'); } })));
    } else {
      el.replaceChildren(
        h('div', { class: 'annot-ts' }, fmtTime(a.ts)),
        h('label', { class: 'filled' }, h('span', { class: 'filled-label' }, 'Annotate'), ta),
        counter,
        h('div', { class: 'filled tags' }, tagIn),
        h('div', { class: 'chips' }, a.tags.map((t, i) => chip(t, { onDelete: () => { a.tags.splice(i, 1); draw(); } }))),
        h('div', { class: 'row-actions right' }, btn('Cancel', { variant: 'dark', small: true, onClick: () => (existing ? ((mode = 'saved'), draw()) : closeAnnotation()) }), save));
      upd();
      setTimeout(() => ta.focus(), 30);
    }
    place();
  };
  draw();
}
