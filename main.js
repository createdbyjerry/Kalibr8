import { state, ui, on, emit, flightById, planFor, buildingById, connectedDrone, droneById } from './store.js';
import { createMap } from './map.js';
import { SEVERITY, pathPointAt } from './geo.js';
import { h, icon, toast, modal, btn, field } from './ui.js';
import { live, onTick } from './sim.js';
import { renderFeed, renderHud } from './views/flight-hud.js';
import * as drones from './views/drones.js';
import * as flights from './views/flights.js';
import * as review from './views/review.js';
import * as reports from './views/reports.js';
import { openSettings } from './views/settings.js';
import { openAnnotation } from './views/annotate.js';
import { processOutbox } from './views/reports.js';

const VIEWS = { drones, flights, review, reports };
const drawer = document.getElementById('drawer');
const map = createMap(document.getElementById('map'));
export const app = { map, go, refreshMap, rerender, isOnline };

// ---------- rail ----------
const NAV = [
  { id: 'drones', icon: 'drone', label: 'Connect drone' },
  { id: 'flights', icon: 'list', label: 'Flight log & planning' },
  { id: 'review', icon: 'addLocation', label: 'Damage review' },
  { id: 'reports', icon: 'chart', label: 'Reports' },
];
const rail = document.getElementById('rail-nav');
NAV.forEach((n) => rail.append(h('button', { class: 'rail-btn', 'data-panel': n.id, title: n.label, 'aria-label': n.label, onclick: () => go(n.id) }, icon(n.icon))));
document.getElementById('btn-layers').append(icon('layers'));
document.getElementById('btn-settings').append(icon('settings'));
document.getElementById('btn-fit').append(icon('area'));
document.getElementById('drawer-open').append(icon('collapse'));
document.getElementById('drawer-open').addEventListener('click', () => { document.body.classList.remove('drawer-collapsed'); });
document.head.append(h('style', {}, reports.REPORT_CSS));
document.getElementById('btn-layers').addEventListener('click', openLayers);
document.getElementById('btn-settings').addEventListener('click', () => openSettings(app));
document.getElementById('zoom-in').addEventListener('click', map.zoomIn);
document.getElementById('zoom-out').addEventListener('click', map.zoomOut);
document.getElementById('btn-fit').addEventListener('click', () => fitToContext());

// ---------- journey stepper ----------
const STEPS = [
  { id: 'drones', label: 'Connect' },
  { id: 'flights', label: 'Plan' },
  { id: 'fly', label: 'Fly' },
  { id: 'review', label: 'Review' },
  { id: 'reports', label: 'Report' },
];
function stepDone(id) {
  if (id === 'drones') return !!state.connectedId;
  if (id === 'flights') return state.flights.length > 0;
  if (id === 'fly') return state.flights.some((f) => f.status === 'completed');
  if (id === 'review') return state.findings.some((f) => f.verified);
  if (id === 'reports') return state.reports.length > 0;
}
function renderStepper() {
  const el = document.getElementById('stepper');
  const current = ui.panel === 'flights' && (live.flightId) ? 'fly' : ui.panel;
  el.replaceChildren(...STEPS.map((s, i) => h('button', { class: `step ${stepDone(s.id) ? 'done' : ''} ${current === s.id ? 'cur' : ''}`, onclick: () => go(s.id === 'fly' ? 'flights' : s.id) },
    h('span', { class: 'step-n' }, stepDone(s.id) ? icon('check') : String(i + 1)), h('span', { class: 'step-l' }, s.label))));
}

// ---------- network ----------
function isOnline() {
  const m = state.settings.network;
  return m === 'auto' ? navigator.onLine : m === 'online';
}
function renderNet() {
  const on = isOnline();
  const d = connectedDrone();
  document.getElementById('net-pill').replaceChildren(icon(on ? 'cloudDone' : 'cloudOff'), h('span', {}, on ? 'Online' : 'Offline mode'));
  document.getElementById('net-pill').className = `pill ${on ? 'ok' : 'warn'}`;
  document.getElementById('rail-net').replaceChildren(icon(on ? 'cloudDone' : 'cloudOff'), h('span', {}, on ? 'Online' : 'Offline'));
  document.getElementById('rail-net').className = `rail-net ${on ? 'ok' : 'warn'}`;
  const lp = document.getElementById('link-pill');
  lp.className = `pill ${d ? 'ok' : 'off'}`;
  lp.replaceChildren(icon('drone'), h('span', {}, d ? `${d.name} · ${linkLabel(state.link?.method)}` : 'No drone linked'));
  lp.onclick = () => go('drones');
  const q = state.reports.filter((r) => r.status === 'queued').length;
  const ob = document.getElementById('outbox-pill');
  ob.hidden = !q;
  ob.replaceChildren(icon('send'), h('span', {}, `${q} queued`));
  ob.onclick = () => go('reports');
}
export const linkLabel = (m) => ({ usb: 'Controller USB-C', wifi: 'Drone Wi-Fi', ble: 'Bluetooth LE' }[m] || 'Direct link');
window.addEventListener('online', () => { renderNet(); processOutbox(app); });
window.addEventListener('offline', renderNet);
setInterval(() => processOutbox(app), 4000);

// ---------- navigation ----------
function go(panel) {
  ui.panel = panel;
  document.body.classList.remove('drawer-collapsed');
  if (panel !== 'flights' && !live.flightId) ui.annotateMode = false;
  rerender();
  fitToContext();
}
function rerender() {
  document.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.panel === ui.panel));
  const v = VIEWS[ui.panel];
  const scroll = drawer.querySelector('.drawer-body')?.scrollTop || 0;
  drawer.replaceChildren(v.render(app));
  const body = drawer.querySelector('.drawer-body');
  if (body && v.keepScroll !== false) body.scrollTop = scroll;
  renderStepper();
  renderNet();
  refreshMap();
  renderHud(app);
}

function fitToContext() {
  const f = ui.draft?.poly?.length >= 3 ? { poly: ui.draft.poly } : flightById(ui.selectedFlight);
  if (f?.poly?.length >= 3) {
    const xs = f.poly.map((p) => p[0]), ys = f.poly.map((p) => p[1]);
    map.fit({ x: Math.min(...xs) - 60, y: Math.min(...ys) - 60, x2: Math.max(...xs) + 60, y2: Math.max(...ys) + 60 });
  } else map.fit({ x: 520, y: 380, x2: 1820, y2: 1280 });
}

// ---------- map layers ----------
const HOME = { x: 1110, y: 1180, heading: -Math.PI / 2 };
function refreshMap() {
  const L = ui.layers;
  map.showBuildings(L.buildings);
  const flight = flightById(ui.selectedFlight);
  // plan
  if (ui.draft) {
    const plan = ui.draft.poly?.length >= 3 ? planFor(ui.draft) : null;
    map.renderPlan(L.plan ? ui.draft.poly : null, plan?.wps, { editable: ui.drawMode });
  } else if (flight && L.plan) {
    const plan = planFor(flight);
    let flown = [];
    if (plan && flight.progress > 0) {
      const p = pathPointAt(plan.wps, flight.progress);
      flown = plan.wps.slice(0, p.seg).concat([[p.x, p.y]]);
    }
    map.renderPlan(flight.poly, plan?.wps, { flown });
  } else map.renderPlan(null);

  // findings + annotations
  const inReview = ui.panel === 'review' || ui.panel === 'reports';
  const flightIds = flight ? [flight.id] : state.flights.map((f) => f.id);
  const showFindings = L.findings && (inReview || (flight && flight.status !== 'planned'));
  const fs = showFindings ? review.filteredFindings(flightIds) : [];
  map.renderDamage(inReview ? fs : [], buildingById);
  const markers = [];
  fs.forEach((f) => {
    const b = buildingById(f.buildingId);
    const sev = f.severityFinal || f.severity;
    if (sev === 'none' && !inReview) return;
    markers.push({ id: f.id, kind: 'finding', x: b.x + b.w / 2, y: b.y + b.h / 2, color: SEVERITY[sev].color, selected: ui.selectedFinding === f.id, verified: f.verified });
  });
  if (L.annotations) review.filteredAnnotations(flightIds).forEach((a) => markers.push({ id: a.id, kind: 'annotation', x: a.x, y: a.y, selected: ui.selectedFinding === a.id }));
  map.renderMarkers(markers);

  // drone
  const d = connectedDrone();
  if (live.flightId && live.pos) map.renderDrone(live.pos, live.plan?.footW);
  else if (d) map.renderDrone(HOME);
  else map.renderDrone(null);
  document.body.classList.toggle('annotating', ui.annotateMode);
  document.body.classList.toggle('drawing', ui.drawMode);
}

map.onClick((e) => {
  if (ui.drawMode && ui.draft) {
    if (e.kind) return;
    ui.draft.poly.push([Math.round(e.x), Math.round(e.y)]);
    refreshMap(); flights.renderDrawBar(app);
    return;
  }
  if (e.kind === 'finding') { ui.selectedFinding = e.target; if (ui.panel !== 'review') ui.panel = 'review'; rerender(); review.scrollToSelected(); return; }
  if (e.kind === 'annotation') { openAnnotation(app, { id: e.target }); return; }
  if (ui.annotateMode) { openAnnotation(app, { x: e.x, y: e.y }); return; }
});
map.onVertex((i, [x, y]) => { if (ui.draft) { ui.draft.poly[i] = [Math.round(x), Math.round(y)]; refreshMap(); } }, () => flights.renderDrawBar(app));

// ---------- live updates ----------
onTick(() => {
  if (live.pos) { refreshMapLight(); }
  renderHud(app);
  renderFeed();
});
function refreshMapLight() {
  const f = flightById(live.flightId);
  if (!f) return;
  const plan = live.plan;
  const p = live.pos;
  map.renderDrone(p, plan.footW);
  if (ui.selectedFlight === f.id && !ui.draft) {
    const flown = plan.wps.slice(0, p.seg).concat([[p.x, p.y]]);
    map.renderPlan(f.poly, plan.wps, { flown });
  }
}
on((what) => {
  if (what === 'tick') {
    // new detections / periodic save: refresh lists without full redraw cost
    if (ui.panel === 'flights' || ui.panel === 'review') rerender();
    return;
  }
  rerender();
});

// ---------- layers popover ----------
function openLayers() {
  const row = (key, label) => h('label', { class: 'switch-row' }, h('span', {}, label),
    h('input', { type: 'checkbox', class: 'switch', checked: ui.layers[key], onchange: (e) => { ui.layers[key] = e.target.checked; refreshMap(); } }));
  modal({ title: 'Map layers', body: h('div', { class: 'stack' }, row('buildings', 'Building footprints'), row('plan', 'Flight plan & path'), row('findings', 'Damage findings'), row('annotations', 'Annotations'),
    h('p', { class: 'muted small' }, 'Basemap is stored on this device — no internet or map tiles required.')) });
}

// ---------- boot ----------
if (!ui.selectedFlight && state.flights[0]) ui.selectedFlight = state.flights[0].id;
// Resume a mission interrupted by an app reload as paused
state.flights.forEach((f) => { if (f.status === 'in-progress') f.status = 'paused'; });
go(state.connectedId ? 'flights' : 'drones');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(() => {
    if (!localStorage.getItem('uav-offline-ready')) { localStorage.setItem('uav-offline-ready', '1'); toast('Saved for offline use — this app now works with no connection.'); }
  }).catch(() => {});
}
window.__app = app; // handy for debugging in Safari Web Inspector
