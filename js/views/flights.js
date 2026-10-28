// Step 2 & 3 — Flight log, the New Flight wizard (plan) and mission start (fly).
import { state, ui, emit, nextId, flightById, droneById, planFor, connectedDrone, loadSample } from '../store.js';
import { live, start, stop } from '../sim.js';
import { h, icon, btn, chip, batteryChip, signalChip, statusChip, toast, modal, field, drawerHeader, fmtTime, fmtDur, confirmDialog, emptyState } from '../ui.js';
import { droneImage, droneSpecs } from './drones.js';
import { fmtDMS, surveyPlan } from '../geo.js';

const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In-Progress', paused: 'Paused', completed: 'Completed' };

export function render(app) {
  const rows = state.flights.map((f) => flightRow(app, f));
  return h('div', { class: 'drawer-inner' },
    drawerHeader('Flight Log'),
    h('div', { class: 'drawer-body' },
      state.flights.length ? h('div', { class: 'table-head' }, h('span', {}, 'LOCATION'), h('span', {}, 'DESCRIPTION'), h('span', {}, 'STATUS')) : null,
      rows.length ? rows : emptyState('No flights yet. Create a survey mission to begin.', h('div', { class: 'stack center' },
        btn('New flight', { icon: 'add', onClick: () => openWizard(app) }),
        btn('Load sample completed survey', { variant: 'text', onClick: () => { const f = loadSample(); ui.selectedFlight = f.id; toast('Sample survey loaded'); app.rerender(); } })))),
    h('div', { class: 'drawer-foot' }, btn('New flight', { icon: 'add', onClick: () => openWizard(app) })));
}

function flightRow(app, f) {
  const open = ui.selectedFlight === f.id;
  const d = droneById(f.droneId);
  const isLive = live.flightId === f.id;
  const plan = planFor(f);
  let loc = '-';
  if (isLive && live.pos) loc = `Live: ${fmtDMS(live.pos.x, live.pos.y, live.alt)}`;
  else if (f.status !== 'planned' && plan) loc = `Take Off: ${fmtDMS(plan.wps[0][0], plan.wps[0][1], 0)}`;
  const actions = [];
  if (f.status === 'planned' || f.status === 'paused') {
    if (f.status === 'planned') {
      actions.push(btn('Delete', { variant: 'dark', small: true, onClick: async () => { if (await confirmDialog('Delete flight?', 'The flight plan will be removed from this device.', 'Delete')) { state.flights = state.flights.filter((x) => x.id !== f.id); emit('flights'); } } }));
      actions.push(btn('Edit', { variant: 'dark', small: true, onClick: () => openWizard(app, f) }));
    }
    actions.push(btn(f.status === 'paused' ? 'Resume flight' : 'Start flight', { small: true, icon: 'takeoff', onClick: () => launch(app, f) }));
  } else if (isLive) {
    actions.push(btn(ui.annotateMode ? 'Annotating' : 'Annotate', { small: true, variant: ui.annotateMode ? 'primary' : 'dark', onClick: () => { ui.annotateMode = !ui.annotateMode; app.rerender(); } }));
  } else if (f.status === 'completed') {
    actions.push(btn('Review damage', { small: true, icon: 'arrow', onClick: () => app.go('review') }));
  }
  return h('div', { class: `frow ${open ? 'open' : ''}` },
    h('button', { class: 'frow-head', onclick: () => { ui.selectedFlight = open ? null : f.id; app.rerender(); if (!open) app.map && setTimeout(() => document.getElementById('btn-fit').click(), 0); } },
      icon(open ? 'expandLess' : 'expandMore', 'exp'),
      h('span', { class: 'loc link' }, f.location),
      h('span', { class: 'desc' }, f.desc || f.name),
      h('span', { class: `st st-${f.status}` }, STATUS_LABEL[f.status])),
    open ? h('div', { class: 'frow-body' },
      kvRow('ID', f.id),
      kvRow('MISSION TAGS', h('div', { class: 'chips' }, f.tags.map((t) => chip(t)))),
      kvRow('TIME', h('div', {}, h('div', {}, `Start: ${f.start ? fmtTime(f.start) : '-'}`), h('div', {}, `End: ${f.end ? fmtTime(f.end) : '-'}`))),
      kvRow('DRONE', h('div', { class: 'drone-cell' }, droneSpecs(d), h('div', { class: 'chip-col' }, statusChip(isLive ? 'live' : f.status === 'completed' ? 'playback' : state.connectedId === d.id ? 'live' : 'off'), batteryChip(d.battery, d.available), signalChip(isLive ? live.signal : d.available ? d.signal : 'none'))), 'tall'),
      kvRow('FLIGHT PLAN', h('div', {}, h('div', {}, f.planName), plan ? h('div', { class: 'muted small' }, `${plan.areaHa.toFixed(1)} ha · ${f.params.altitude} m AGL · ${plan.photos} photos · ~${fmtDur(plan.timeS)} · GSD ${plan.gsd.toFixed(1)} cm/px`) : null)),
      kvRow('LOCATION', loc),
      h('div', { class: 'row-actions right' }, actions)) : null);
}
function kvRow(k, v, cls = '') { return h('div', { class: `kvrow ${cls}` }, h('span', { class: 'k' }, k), h('div', { class: 'v' }, v)); }

function launch(app, f) {
  const d = connectedDrone();
  if (!d || d.id !== f.droneId) {
    toast(`Connect ${droneById(f.droneId).name} before starting this flight.`, 'err');
    app.go('drones');
    return;
  }
  if (live.flightId && live.flightId !== f.id) stop();
  ui.selectedFlight = f.id;
  start(f.id);
  toast('Mission uploaded — takeoff. Autonomous survey in progress.', 'ok');
  app.rerender();
  setTimeout(() => document.getElementById('btn-fit').click(), 0);
}

// ---------------- New Flight wizard ----------------
let wiz = null;
export function openWizard(app, existing) {
  const conn = connectedDrone();
  ui.draft = existing ? structuredClone(existing) : {
    id: null, name: `Survey ${state.flights.length + 1}`, desc: '', location: 'Miami, FL', tags: [`${state.settings.incident.name} ${new Date().getFullYear()}`],
    droneId: conn?.id || null, poly: [], params: { altitude: 60, speed: 9, frontlap: 75, sidelap: 70 }, checks: {},
  };
  ui.draft.checks = ui.draft.checks || {};
  wiz = { step: existing ? 1 : 0, app, existing: !!existing };
  showWizard();
}

function showWizard() {
  const { app } = wiz;
  const d = ui.draft;
  const plan = d.poly.length >= 3 && d.droneId ? surveyPlan(d.poly, d.params, droneById(d.droneId)) : null;
  const steps = [stepDrone, stepMission, stepChecklist];
  const canNext = [() => !!d.droneId, () => d.poly.length >= 3 && d.name.trim(), () => true][wiz.step]();
  const allChecked = CHECKS.every((c) => d.checks[c.id]);
  const footer = [
    h('div', { class: 'dots' }, [0, 1, 2].map((i) => h('i', { class: i === wiz.step ? 'on' : '' }))),
    h('span', { class: 'grow' }),
    wiz.step > 0 ? btn('Back', { variant: 'dark', onClick: () => { wiz.step--; rerenderWizard(); } }) : null,
    wiz.step < 2 ? btn('Next', { disabled: !canNext, onClick: () => { wiz.step++; rerenderWizard(); } }) : null,
    wiz.step === 2 ? btn('Save plan', { variant: 'dark', onClick: () => saveDraft(false) }) : null,
    wiz.step === 2 ? btn('Save & start flight', { icon: 'takeoff', disabled: !allChecked, title: allChecked ? '' : 'Complete the pre-flight checklist', onClick: () => saveDraft(true) }) : null,
  ];
  wiz.modal?.el.remove();
  wiz.modal = modal({ title: wiz.existing ? 'Edit Flight' : 'New Flight', body: steps[wiz.step](plan), footer, cls: 'wizard', onClose: () => { ui.draft = null; ui.drawMode = false; wiz = null; app.rerender(); } });
  app.refreshMap();
}
function rerenderWizard() { const sc = wiz.modal?.el.querySelector('.dialog-body')?.scrollTop; showWizard(); if (sc) wiz.modal.el.querySelector('.dialog-body').scrollTop = sc; }

function stepDrone() {
  const d = ui.draft;
  return h('div', {},
    h('div', { class: 'step-head' }, h('h3', {}, 'Select sUAS'), btn('New', { variant: 'dark', small: true, icon: 'add', onClick: () => { const a = wiz.app; wiz.modal.close(); a.go('drones'); } })),
    h('div', { class: 'pick-list' }, state.drones.map((dr) => h('button', { class: `pick ${d.droneId === dr.id ? 'sel' : ''}`, disabled: !dr.available, onclick: () => { d.droneId = dr.id; rerenderWizard(); } },
      droneImage(dr), droneSpecs(dr), h('div', { class: 'chip-col' }, state.connectedId === dr.id ? statusChip('live') : null, batteryChip(dr.battery, dr.available), signalChip(dr.available ? dr.signal : 'none'))))),
    d.droneId && state.connectedId !== d.droneId ? h('p', { class: 'note warn' }, icon('warning'), 'This aircraft is not linked. You can save the plan now and connect before takeoff.') : null);
}

function stepMission(plan) {
  const d = ui.draft;
  const dr = droneById(d.droneId);
  const tagInput = h('input', { class: 'input', placeholder: 'Add tag and press Enter', onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); d.tags.push(e.target.value.trim()); rerenderWizard(); } } });
  const slider = (key, label, min, max, step, unit, hint) => field(`${label}: ${d.params[key]} ${unit}`,
    h('input', { type: 'range', min, max, step, value: d.params[key], oninput: (e) => { d.params[key] = +e.target.value; e.target.closest('.field').querySelector('.field-label').textContent = `${label}: ${d.params[key]} ${unit}`; updateEst(); wiz.app.refreshMap(); } }), hint);
  const est = h('div', { class: 'est' });
  function updateEst() {
    const p = d.poly.length >= 3 ? surveyPlan(d.poly, d.params, dr) : null;
    est.replaceChildren(...(p ? [
      estItem('Area', `${p.areaHa.toFixed(1)} ha`), estItem('Flight time', `~${fmtDur(p.timeS)}`), estItem('Photos', p.photos), estItem('GSD', `${p.gsd.toFixed(1)} cm/px`), estItem('Batteries', p.batteries, p.batteries > 1 ? 'warn' : ''), estItem('Line spacing', `${p.spacing.toFixed(0)} m`),
    ] : [h('span', { class: 'muted small' }, 'Draw the survey area to see estimates.')]));
  }
  updateEst();
  return h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      field('Flight name', h('input', { class: 'input', value: d.name, oninput: (e) => { d.name = e.target.value; } })),
      field('Location', h('input', { class: 'input', value: d.location, oninput: (e) => { d.location = e.target.value; } }))),
    field('Description', h('input', { class: 'input', value: d.desc, placeholder: 'e.g. Residential damage survey, sector 4', oninput: (e) => { d.desc = e.target.value; } })),
    field('Mission tags', h('div', { class: 'tag-input' }, h('div', { class: 'chips' }, d.tags.map((t, i) => chip(t, { variant: 'primary', onDelete: () => { d.tags.splice(i, 1); rerenderWizard(); } }))), tagInput)),
    h('div', { class: 'area-box' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Survey area'), h('div', {}, d.poly.length >= 3 ? `${d.poly.length}-point polygon` : 'No area drawn yet')),
      h('div', { class: 'row-actions' },
        btn('Use sample sector', { variant: 'text', small: true, onClick: () => { d.poly = [[720, 540], [1500, 510], [1560, 980], [780, 1040]]; rerenderWizard(); document.getElementById('btn-fit').click(); } }),
        btn(d.poly.length ? 'Edit on map' : 'Draw on map', { small: true, icon: 'area', onClick: () => startDraw() }))),
    est,
    h('div', { class: 'grid2' },
      slider('altitude', 'Altitude', 30, 120, 5, 'm AGL', 'Part 107 limit: 122 m (400 ft) AGL'),
      slider('speed', 'Speed', 3, 15, 1, 'm/s'),
      slider('frontlap', 'Front overlap', 60, 90, 5, '%'),
      slider('sidelap', 'Side overlap', 60, 90, 5, '%', 'Use 70%+ for 3D / orthomosaic')));
}
const estItem = (k, v, cls = '') => h('div', { class: `est-item ${cls}` }, h('span', { class: 'k' }, k), h('b', {}, String(v)));

const CHECKS = [
  { id: 'airspace', label: 'Airspace & TFRs checked', sub: 'Disaster TFRs are common after storms — confirm via the EOC / radio when LAANC is unavailable offline.' },
  { id: 'wx', label: 'Wind and weather within aircraft limits' },
  { id: 'vo', label: 'Visual observer briefed; line-of-sight maintained' },
  { id: 'hazards', label: 'Launch site clear of debris and power lines' },
  { id: 'aircraft', label: 'Props, frame and camera inspected; batteries charged' },
  { id: 'rth', label: 'Lost-link action set to Return-to-Home at safe altitude' },
];
function stepChecklist(plan) {
  const d = ui.draft;
  const dr = droneById(d.droneId);
  return h('div', { class: 'stack' },
    h('div', { class: 'summary-card' },
      droneImage(dr, 'sm'),
      h('div', {}, h('b', {}, d.name), h('div', { class: 'muted small' }, `${dr.name} · ${d.params.altitude} m AGL · ${d.params.speed} m/s · ${d.params.frontlap}/${d.params.sidelap}% overlap`),
        plan ? h('div', { class: 'muted small' }, `${plan.areaHa.toFixed(1)} ha · ~${fmtDur(plan.timeS)} · ${plan.photos} photos · ${plan.batteries} battery${plan.batteries > 1 ? ' swaps' : ''}`) : null)),
    h('div', { class: 'eyebrow' }, 'Pre-flight checklist'),
    h('div', { class: 'checks' }, CHECKS.map((c) => h('label', { class: `check ${d.checks[c.id] ? 'on' : ''}` },
      h('input', { type: 'checkbox', checked: !!d.checks[c.id], onchange: (e) => { d.checks[c.id] = e.target.checked; rerenderWizard(); } }),
      h('span', { class: 'box' }, icon('check')), h('span', {}, h('span', {}, c.label), c.sub ? h('small', {}, c.sub) : null)))),
    h('p', { class: 'muted small' }, 'The plan is stored on this device and uploaded to the aircraft over the direct link — it does not need a connection.'));
}

function saveDraft(andStart) {
  const app = wiz.app;
  const d = ui.draft;
  let f = d.id ? flightById(d.id) : null;
  if (!f) {
    f = { ...d, id: nextId('F'), status: 'planned', created: Date.now(), start: null, end: null, progress: 0, photos: 0 };
    f.planName = `${d.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${d.params.altitude}M`;
    state.flights.unshift(f);
  } else {
    Object.assign(f, d, { planName: `${d.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${d.params.altitude}M` });
  }
  delete f.checks;
  ui.selectedFlight = f.id;
  ui.draft = null; ui.drawMode = false;
  wiz.modal.el.remove(); wiz = null;
  emit('flights');
  toast(andStart ? 'Plan saved' : 'Flight plan saved to Flight Log', 'ok');
  if (andStart) launch(app, f);
}

// ---------------- drawing on the map ----------------
function startDraw() {
  ui.drawMode = true;
  wiz.modal.el.style.display = 'none';
  renderDrawBar(wiz.app);
  wiz.app.refreshMap();
}
export function renderDrawBar(app) {
  const bar = document.getElementById('drawbar');
  if (!ui.drawMode || !ui.draft) { bar.hidden = true; return; }
  const n = ui.draft.poly.length;
  bar.hidden = false;
  bar.replaceChildren(
    icon('area'),
    h('span', {}, n < 3 ? `Tap the map to place corners of the survey area (${n} placed)` : `${n} corners · drag points to adjust`),
    btn('Undo', { variant: 'dark', small: true, icon: 'undo', disabled: !n, onClick: () => { ui.draft.poly.pop(); app.refreshMap(); renderDrawBar(app); } }),
    btn('Clear', { variant: 'dark', small: true, disabled: !n, onClick: () => { ui.draft.poly = []; app.refreshMap(); renderDrawBar(app); } }),
    btn('Done', { small: true, icon: 'check', disabled: n > 0 && n < 3, onClick: () => { ui.drawMode = false; bar.hidden = true; wiz.modal.el.style.display = ''; rerenderWizard(); } }));
}
