// Step 4 — review AI-flagged damage, verify each structure, manage annotations.
import { state, ui, emit, buildingById, findingCost, totalsFor, flightById, loadSample } from '../store.js';
import { SEVERITY, SEVERITY_ORDER, fmtLatLon } from '../geo.js';
import { h, icon, btn, chip, money, fmtTime, drawerHeader, emptyState, toast } from '../ui.js';
import { thumb } from '../feed.js';
import { openAnnotation } from './annotate.js';

let tab = 'structures';
let flightFilter = 'all';

const scopeIds = () => {
  const done = state.flights.filter((f) => f.status !== 'planned');
  return flightFilter === 'all' ? done.map((f) => f.id) : [flightFilter];
};

export function filteredFindings(flightIds) {
  const q = ui.filters.q.trim().toLowerCase();
  const sevs = ui.filters.severity;
  return state.findings.filter((f) => {
    if (!flightIds.includes(f.flightId)) return false;
    const sev = f.severityFinal || f.severity;
    if (sevs.size && !sevs.has(sev)) return false;
    if (q) {
      const b = buildingById(f.buildingId);
      const fl = flightById(f.flightId);
      const hay = `${b.address} ${b.id} ${SEVERITY[sev].label} ${f.notes} ${fl?.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
export function filteredAnnotations(flightIds) {
  const q = ui.filters.q.trim().toLowerCase();
  return state.annotations.filter((a) => flightIds.includes(a.flightId) && (!q || `${a.text} ${a.tags.join(' ')}`.toLowerCase().includes(q))).sort((a, b) => b.ts - a.ts);
}

const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { const img = e.target; img.src = thumb(buildingById(img.dataset.bid)); io.unobserve(img); } });
}, { rootMargin: '200px' }) : null;
function lazyThumb(b, cls = 'thumb') {
  const img = h('img', { class: cls, alt: `Aerial image of ${b.address}`, 'data-bid': b.id });
  if (io) io.observe(img); else img.src = thumb(b);
  return img;
}

export function render(app) {
  const flights = state.flights.filter((f) => f.status !== 'planned');
  if (!flights.length) {
    return h('div', { class: 'drawer-inner' }, drawerHeader('Damage Review'), h('div', { class: 'drawer-body' },
      emptyState('No survey data yet. Fly a mission (or import from the drone’s SD card) and detected damage appears here.', h('div', { class: 'stack center' },
        btn('Go to flight log', { icon: 'list', onClick: () => app.go('flights') }),
        btn('Load sample completed survey', { variant: 'text', onClick: () => { const f = loadSample(); ui.selectedFlight = f.id; app.rerender(); } })))));
  }
  if (flightFilter !== 'all' && !flightById(flightFilter)) flightFilter = 'all';
  const ids = scopeIds();
  const t = totalsFor(ids);
  const fs = filteredFindings(ids).sort((a, b) => SEVERITY[b.severityFinal || b.severity].rank - SEVERITY[a.severityFinal || a.severity].rank || a.buildingId.localeCompare(b.buildingId));
  const anns = filteredAnnotations(ids);
  const pct = t.structures ? Math.round((t.verified / t.structures) * 100) : 0;

  return h('div', { class: 'drawer-inner' },
    drawerHeader('Damage Review'),
    h('div', { class: 'drawer-body' },
      h('div', { class: 'section pad' },
        h('select', { class: 'input', 'aria-label': 'Flight', onchange: (e) => { flightFilter = e.target.value; ui.selectedFlight = flightFilter === 'all' ? null : flightFilter; ui.selectedFinding = null; app.rerender(); document.getElementById('btn-fit').click(); } },
          h('option', { value: 'all', selected: flightFilter === 'all' }, `All surveyed flights (${flights.length})`),
          flights.map((f) => h('option', { value: f.id, selected: flightFilter === f.id }, `${f.name} — ${f.id}`))),
        h('div', { class: 'tiles' }, SEVERITY_ORDER.slice(0, 4).map((k) => h('button', { class: `tile ${ui.filters.severity.has(k) ? 'active' : ''}`, style: { '--c': SEVERITY[k].color }, onclick: () => { toggleSev(k); app.rerender(); } },
          h('span', { class: 'tile-n' }, t.bySev[k].count), h('span', { class: 'tile-l' }, SEVERITY[k].label)))),
        h('div', { class: 'total-row' }, h('div', {}, h('span', { class: 'eyebrow' }, 'Estimated loss'), h('b', { class: 'big' }, money(t.cost))),
          h('div', { class: 'verify' }, h('span', { class: 'small muted' }, `${t.verified} of ${t.structures} verified`), h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } })))),
        h('div', { class: 'search' }, icon('search'), h('input', { class: 'input bare', placeholder: 'Search address, ID or tags', value: ui.filters.q, oninput: debounce((e) => { ui.filters.q = e.target.value; app.rerender(); refocus(); }) })),
        ui.filters.severity.size || ui.filters.q ? h('div', { class: 'chips' },
          [...ui.filters.severity].map((k) => chip(SEVERITY[k].label, { variant: 'primary', onDelete: () => { toggleSev(k); app.rerender(); } })),
          ui.filters.q ? chip(`“${ui.filters.q}”`, { variant: 'primary', onDelete: () => { ui.filters.q = ''; app.rerender(); } }) : null) : null),
      h('div', { class: 'tabs' },
        h('button', { class: tab === 'structures' ? 'on' : '', onclick: () => { tab = 'structures'; app.rerender(); } }, `Structures (${fs.length})`),
        h('button', { class: tab === 'annotations' ? 'on' : '', onclick: () => { tab = 'annotations'; app.rerender(); } }, `Annotations (${anns.length})`),
        tab === 'structures' ? btn('Accept AI ≥ 90%', { variant: 'text', small: true, onClick: () => bulkAccept(ids, app) }) : null),
      tab === 'structures'
        ? (fs.length ? h('div', { class: 'cards' }, fs.map((f) => findingCard(app, f))) : emptyState('No structures match these filters.'))
        : (anns.length ? h('div', { class: 'cards' }, anns.map((a) => annCard(app, a))) : emptyState('There are no annotations. Use Annotate during a flight to drop notes on the map.'))),
    h('div', { class: 'drawer-foot' }, btn('Next: generate report', { icon: 'arrow', onClick: () => app.go('reports') })));
}

function findingCard(app, f) {
  const b = buildingById(f.buildingId);
  const sev = f.severityFinal || f.severity;
  const sel = ui.selectedFinding === f.id;
  const head = h('div', { class: 'fcard-head', onclick: () => { ui.selectedFinding = sel ? null : f.id; app.rerender(); if (!sel) app.map.centerOn(b.x + b.w / 2, b.y + b.h / 2); } },
    lazyThumb(b),
    h('div', { class: 'fcard-meta' },
      h('b', {}, b.address),
      h('span', { class: 'muted small' }, `${b.id} · ${b.type === 'commercial' ? 'Commercial' : 'Residential'}`),
      h('div', { class: 'chips' }, chip(SEVERITY[sev].label, { color: SEVERITY[sev].color }),
        f.verified ? h('span', { class: 'ver-tag' }, icon('check'), 'Verified') : h('span', { class: 'ai-tag' }, `AI ${Math.round(f.confidence * 100)}%`))),
    h('div', { class: 'fcard-cost' }, money(findingCost(f))));
  if (!sel) return h('div', { class: 'fcard' }, head);
  const notes = h('textarea', { class: 'input', rows: 2, placeholder: 'Field notes (visible in the report)', oninput: (e) => { f.notes = e.target.value; } , onblur: () => emit('finding') }, f.notes);
  const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: (e) => attachPhoto(e, f) });
  return h('div', { class: 'fcard sel', id: `card-${f.id}` }, head,
    h('div', { class: 'fcard-body' },
      h('div', { class: 'big-thumb' }, h('img', { src: f.photo || thumb(b, 460, 300), alt: '' }), h('span', { class: 'img-cap' }, f.photo ? 'Field photo' : `IMG_${String(f.photoN).padStart(4, '0')}.JPG · ${fmtTime(f.ts)}`)),
      h('div', { class: 'kv-grid' },
        kv('Coordinates', fmtLatLon(b.x + b.w / 2, b.y + b.h / 2)),
        kv('Assessed value', money(b.value)),
        kv('AI suggestion', `${SEVERITY[f.severity].label} (${Math.round(f.confidence * 100)}%)`),
        kv('Stories', b.stories)),
      h('div', { class: 'eyebrow' }, 'Damage category'),
      h('div', { class: 'sev-seg' }, SEVERITY_ORDER.map((k) => h('button', { class: sev === k ? 'on' : '', style: { '--c': SEVERITY[k].color }, onclick: () => { f.severityFinal = k; f.verified = true; emit('finding'); } }, h('i'), SEVERITY[k].label))),
      notes,
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Loss override ($)'),
          h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: money(findingCost({ ...f, costOverride: null })), value: f.costOverride ?? '', onchange: (e) => { f.costOverride = e.target.value === '' ? null : +e.target.value; emit('finding'); } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Ground photo'), btn(f.photo ? 'Replace photo' : 'Attach photo', { variant: 'dark', small: true, icon: 'image', onClick: () => fileIn.click() }), fileIn)),
      h('div', { class: 'row-actions right' },
        btn(f.verified ? 'Verified' : 'Confirm AI category', { variant: f.verified ? 'dark' : 'primary', small: true, icon: 'check', onClick: () => { f.verified = true; if (!f.severityFinal) f.severityFinal = f.severity; emit('finding'); } }),
        btn('Next unverified', { small: true, variant: 'dark', icon: 'arrow', onClick: () => nextUnverified(app) }))));
}

function annCard(app, a) {
  return h('div', { class: `acard ${ui.selectedFinding === a.id ? 'sel' : ''}`, onclick: () => { ui.selectedFinding = a.id; app.map.centerOn(a.x, a.y); openAnnotation(app, { id: a.id }); } },
    h('div', { class: 'acard-ts' }, fmtTime(a.ts)),
    h('p', {}, a.text),
    h('div', { class: 'chips' }, a.tags.map((t) => chip(t))));
}

function nextUnverified(app) {
  const list = filteredFindings(scopeIds()).filter((f) => !f.verified).sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank);
  const n = list.find((f) => f.id !== ui.selectedFinding);
  if (!n) { toast('All structures in view are verified', 'ok'); return; }
  ui.selectedFinding = n.id;
  const b = buildingById(n.buildingId);
  app.rerender(); app.map.centerOn(b.x + b.w / 2, b.y + b.h / 2); scrollToSelected();
}

function bulkAccept(ids, app) {
  let n = 0;
  state.findings.forEach((f) => { if (ids.includes(f.flightId) && !f.verified && f.confidence >= 0.9) { f.verified = true; f.severityFinal = f.severity; n++; } });
  emit('finding');
  toast(n ? `Accepted ${n} high-confidence AI assessments` : 'No unverified findings at ≥ 90% confidence');
}

function attachPhoto(e, f) {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, 720 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = img.width * s; c.height = img.height * s;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    f.photo = c.toDataURL('image/jpeg', 0.78);
    URL.revokeObjectURL(img.src);
    emit('finding');
  };
  img.src = URL.createObjectURL(file);
}

function toggleSev(k) { const s = ui.filters.severity; s.has(k) ? s.delete(k) : s.add(k); }
export function scrollToSelected() { requestAnimationFrame(() => document.querySelector('.fcard.sel, .acard.sel')?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }
function kv(k, v) { return h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, String(v))); }
function debounce(fn) { let t; return (e) => { clearTimeout(t); t = setTimeout(() => fn(e), 250); }; }
function refocus() { const el = document.querySelector('.search input'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
