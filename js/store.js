// App state, persisted to localStorage so everything survives with no network.
import { city, surveyPlan, buildingsIn, SEVERITY } from './geo.js';

const KEY = 'uav-survey-v1';
const listeners = new Set();

export const DEFAULT_SETTINGS = {
  simSpeed: 10,
  network: 'auto', // auto | offline | online  (override for demos)
  factors: { destroyed: 1.0, major: 0.5, minor: 0.15, affected: 0.05, none: 0 },
  pilot: { name: 'J. Rivera', cert: 'FAA Part 107 #4471902', org: 'County Emergency Management — UAS Team' },
  incident: { name: 'Hurricane Delta', declaration: 'Pending', county: 'Miami-Dade County, FL' },
};

const DRONES = [
  { id: 'd1', name: 'Parrot Anafi', kind: 'quad', serial: 'PI040416AA8C112', sensor: 'EO 21MP', flightMin: 25, weight: '320g', hfov: 69, aspect: 0.75, imgW: 5344, battery: 98, signal: 'strong', available: true, firmware: '1.8.2', sats: 14, storageGB: 54 },
  { id: 'd2', name: 'SenseFly eBee X', kind: 'wing', serial: 'EBX-0X99A2310', sensor: 'EO S.O.D.A 20MP', flightMin: 55, weight: '1.4kg', hfov: 64, aspect: 0.67, imgW: 5472, battery: 20, signal: 'weak', available: true, firmware: '4.2.0', sats: 11, storageGB: 61 },
  { id: 'd3', name: 'Survey Quad (spare)', kind: 'quad2', serial: 'SQ2-0000000318', sensor: 'EO 12MP', flightMin: 30, weight: '895g', hfov: 72, aspect: 0.75, imgW: 4000, battery: 0, signal: 'none', available: false, firmware: '—', sats: 0, storageGB: 0 },
];

function fresh() {
  return { settings: structuredClone(DEFAULT_SETTINGS), drones: structuredClone(DRONES), connectedId: null, link: null, flights: [], findings: [], annotations: [], reports: [], seq: 1 };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...structuredClone(DEFAULT_SETTINGS), ...s.settings };
      return s;
    }
  } catch (e) { /* storage unavailable: fall back to memory */ }
  return fresh();
}

export const state = load();
// Live-only (not persisted)
export const ui = { panel: 'drones', selectedFlight: null, selectedFinding: null, annotateMode: false, drawMode: false, draft: null, filters: { severity: new Set(), q: '' }, layers: { buildings: true, plan: true, findings: true, annotations: true } };

let saveT = null;
export function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }, 150);
}
export function emit(what) { save(); listeners.forEach((fn) => fn(what)); }
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function nextId(prefix) {
  const n = state.seq++;
  return `${prefix}${String(n).padStart(6, '0')}`;
}

export function reset() {
  const f = fresh();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, f);
  emit('reset');
}

export const droneById = (id) => state.drones.find((d) => d.id === id);
export const flightById = (id) => state.flights.find((f) => f.id === id);
export const connectedDrone = () => droneById(state.connectedId);
export const buildingById = (id) => city().buildings.find((b) => b.id === id);

export function planFor(flight) {
  return surveyPlan(flight.poly, flight.params, droneById(flight.droneId));
}

export function findingCost(f) {
  const b = buildingById(f.buildingId);
  if (f.costOverride != null && f.costOverride !== '') return Number(f.costOverride);
  const sev = f.severityFinal || f.severity;
  return Math.round((b?.value ?? 0) * (state.settings.factors[sev] ?? SEVERITY[sev].factor));
}

export function totalsFor(flightIds) {
  const fs = state.findings.filter((f) => flightIds.includes(f.flightId));
  const out = {};
  Object.keys(SEVERITY).forEach((k) => (out[k] = { count: 0, cost: 0, residential: 0, commercial: 0 }));
  fs.forEach((f) => {
    const sev = f.severityFinal || f.severity;
    const b = buildingById(f.buildingId);
    out[sev].count++;
    out[sev].cost += findingCost(f);
    out[sev][b?.type || 'residential']++;
  });
  const all = Object.values(out);
  return {
    bySev: out,
    structures: fs.length,
    damaged: fs.filter((f) => (f.severityFinal || f.severity) !== 'none').length,
    verified: fs.filter((f) => f.verified).length,
    cost: all.reduce((a, b) => a + b.cost, 0),
  };
}

// A complete sample survey so reviewers can jump straight to steps 3–4.
export function loadSample() {
  const poly = [[700, 520], [1560, 480], [1640, 1040], [760, 1100]];
  const f = {
    id: nextId('F'), name: 'Overtown Block Survey', desc: 'Post-landfall residential damage survey, sector 4',
    location: 'Miami, FL', tags: ['Hurricane Delta 2026', 'Sector 4', 'PDA'], droneId: 'd1', status: 'completed',
    poly, params: { altitude: 60, speed: 9, frontlap: 75, sidelap: 70 },
    planName: 'SECTOR4-GRID-60M', created: Date.now() - 3.6e6, start: Date.now() - 3.4e6, end: Date.now() - 2.1e6, progress: 1e9, photos: 0,
  };
  const plan = planFor(f);
  f.photos = plan.photos;
  state.flights.unshift(f);
  buildingsIn(poly).forEach((b, i) => {
    state.findings.push(mkFinding(f, b, f.start + i * 2400));
  });
  state.annotations.push({ id: nextId('A'), flightId: f.id, x: 1110, y: 805, text: 'Downed power lines blocking NW 18th St. Road impassable to vehicles — flag for utility crew.', tags: ['Hazard', 'Utilities'], ts: f.start + 9e5 });
  state.annotations.push({ id: nextId('A'), flightId: f.id, x: 860, y: 955, text: 'Standing water ~0.5 m across intersection. Possible storm drain blockage.', tags: ['Flooding'], ts: f.start + 1.1e6 });
  emit('sample');
  return f;
}

export function mkFinding(flight, b, ts) {
  const conf = 0.71 + ((b.seed % 1000) / 1000) * 0.27;
  return { id: nextId('D'), flightId: flight.id, buildingId: b.id, severity: b.severity, severityFinal: null, verified: false, confidence: +conf.toFixed(2), notes: '', costOverride: null, ts, photoN: 1 + (b.seed % 900) };
}
