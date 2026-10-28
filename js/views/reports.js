// Step 5 — generate regulatory damage reports, export them, and queue them for
// delivery when connectivity returns (store-and-forward outbox).
import { state, ui, emit, save, nextId, totalsFor, buildingById, findingCost, flightById, droneById, planFor } from '../store.js';
import { SEVERITY, SEVERITY_ORDER, fmtLatLon, toLatLon, city, bbox } from '../geo.js';
import { h, icon, btn, chip, money, fmtTime, fmtDur, toast, modal, field, drawerHeader, emptyState } from '../ui.js';
import { thumb } from '../feed.js';

export const REPORT_TYPES = {
  pda: { label: 'FEMA Preliminary Damage Assessment (PDA) — UAS imagery summary', short: 'FEMA PDA summary', recipient: 'FEMA Region IV — Joint PDA Team' },
  sitrep: { label: 'State EOC situation report — damage section', short: 'State EOC sitrep', recipient: 'Florida Division of Emergency Management — State EOC' },
  county: { label: 'County initial damage assessment (IDA)', short: 'County IDA', recipient: 'Miami-Dade County Office of Emergency Management' },
};
const STATUS = { draft: ['Draft', 'off'], queued: ['Queued — waiting for connection', 'warn'], sending: ['Sending…', 'info'], delivered: ['Delivered', 'ok'], failed: ['Failed — will retry', 'err'] };

let form = null;

export function render(app) {
  const done = state.flights.filter((f) => f.status === 'completed' || state.findings.some((x) => x.flightId === f.id));
  if (!form) form = { type: 'pda', flightIds: done.map((f) => f.id), recipient: REPORT_TYPES.pda.recipient, notes: '' };
  form.flightIds = form.flightIds.filter((id) => flightById(id));
  const inc = state.settings.incident;
  const t = totalsFor(form.flightIds);
  const online = app.isOnline();

  return h('div', { class: 'drawer-inner' },
    drawerHeader('Reports'),
    h('div', { class: 'drawer-body' },
      !online ? h('div', { class: 'banner warn' }, icon('cloudOff'), h('span', {}, 'You’re offline. Reports are saved on this device and sent automatically when a connection is available (Wi-Fi, cellular or satellite). You can also share them now with AirDrop or Quick Share, which need no internet.')) : null,
      done.length === 0 ? emptyState('Complete a survey flight to generate a damage report.', btn('Go to flight log', { icon: 'list', onClick: () => app.go('flights') })) :
        h('div', { class: 'section pad stack' },
          h('div', { class: 'eyebrow' }, 'New report'),
          field('Report type', h('select', { class: 'input', onchange: (e) => { form.type = e.target.value; form.recipient = REPORT_TYPES[form.type].recipient; app.rerender(); } },
            Object.entries(REPORT_TYPES).map(([k, v]) => h('option', { value: k, selected: form.type === k }, v.label)))),
          field('Send to', h('input', { class: 'input', value: form.recipient, oninput: (e) => { form.recipient = e.target.value; } })),
          h('div', { class: 'grid2' },
            field('Incident', h('input', { class: 'input', value: inc.name, oninput: (e) => { inc.name = e.target.value; save(); } })),
            field('Declaration / DR #', h('input', { class: 'input', value: inc.declaration, oninput: (e) => { inc.declaration = e.target.value; save(); } }))),
          field('Jurisdiction', h('input', { class: 'input', value: inc.county, oninput: (e) => { inc.county = e.target.value; save(); } })),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Flights included'),
            done.map((f) => h('label', { class: 'check-inline' }, h('input', { type: 'checkbox', checked: form.flightIds.includes(f.id), onchange: (e) => { form.flightIds = e.target.checked ? [...form.flightIds, f.id] : form.flightIds.filter((x) => x !== f.id); app.rerender(); } }), `${f.name} · ${f.id}`))),
          field('Notes for reviewer', h('textarea', { class: 'input', rows: 2, oninput: (e) => { form.notes = e.target.value; } }, form.notes)),
          h('div', { class: 'mini-sum' },
            h('span', {}, `${t.structures} structures`), h('span', {}, `${t.damaged} damaged`), h('span', {}, `${t.verified}/${t.structures} verified`), h('b', {}, money(t.cost))),
          t.verified < t.structures ? h('p', { class: 'note warn' }, icon('warning'), `${t.structures - t.verified} structures still show AI-only categories. They’ll be marked “unverified” in the report.`) : null,
          btn('Generate report', { icon: 'chart', disabled: !form.flightIds.length, onClick: () => { const r = generate(); openPreview(app, r); } })),
      state.reports.length ? h('div', { class: 'list-head' }, h('span', {}, 'Saved reports')) : null,
      h('div', { class: 'cards' }, [...state.reports].reverse().map((r) => h('div', { class: 'rcard' },
        h('div', { class: 'rcard-top' }, h('b', {}, REPORT_TYPES[r.type].short), h('span', { class: 'muted small' }, r.id)),
        h('div', { class: 'muted small' }, `${fmtTime(r.created)} · ${r.recipient}`),
        h('div', { class: 'rcard-bot' }, h('span', { class: `chip chip-status s-${STATUS[r.status][1]}` }, STATUS[r.status][0]), h('b', {}, money(r.totals.cost))),
        h('div', { class: 'row-actions right' },
          btn('Open', { variant: 'dark', small: true, onClick: () => openPreview(app, r) }),
          r.status === 'draft' || r.status === 'failed' ? btn('Send', { small: true, icon: 'send', onClick: () => send(app, r) }) : null))))),
  );
}

function generate() {
  const inc = state.settings.incident;
  const rows = state.findings.filter((f) => form.flightIds.includes(f.flightId)).map((f) => {
    const b = buildingById(f.buildingId);
    const c = toLatLon(b.x + b.w / 2, b.y + b.h / 2);
    return { findingId: f.id, structureId: b.id, address: b.address, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6), type: b.type, category: f.severityFinal || f.severity, aiCategory: f.severity, aiConfidence: f.confidence, verified: f.verified, value: b.value, loss: findingCost(f), notes: f.notes, flightId: f.flightId, capturedAt: f.ts, photoN: f.photoN, hasPhoto: !!f.photo };
  });
  const r = {
    id: nextId('R'), created: Date.now(), type: form.type, recipient: form.recipient, notes: form.notes,
    incident: { ...inc }, pilot: { ...state.settings.pilot }, factors: { ...state.settings.factors },
    flightIds: [...form.flightIds], totals: totalsFor(form.flightIds), rows, status: 'draft',
  };
  state.reports.push(r);
  emit('report');
  return r;
}

// ---------------- report document ----------------
export function reportHTML(r, { embedImages = true } = {}) {
  const T = REPORT_TYPES[r.type];
  const flights = r.flightIds.map(flightById).filter(Boolean);
  const area = flights.reduce((a, f) => a + (planFor(f)?.areaHa || 0), 0);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sumRows = SEVERITY_ORDER.map((k) => {
    const v = r.totals.bySev[k];
    return `<tr><td><span class="sw" style="background:${SEVERITY[k].color}"></span>${SEVERITY[k].label}</td><td>${v.residential}</td><td>${v.commercial}</td><td><b>${v.count}</b></td><td class="num">${money(v.cost)}</td></tr>`;
  }).join('');
  const flightRows = flights.map((f) => {
    const d = droneById(f.droneId); const p = planFor(f);
    return `<tr><td>${esc(f.id)}<br><small>${esc(f.name)}</small></td><td>${esc(d.name)}<br><small>S/N ${esc(d.serial)}</small></td><td>${fmtTime(f.start)}<br><small>to ${fmtTime(f.end)}</small></td><td>${f.params.altitude} m AGL<br><small>GSD ${p.gsd.toFixed(1)} cm/px</small></td><td>${f.photos}</td><td>${p.areaHa.toFixed(1)} ha</td></tr>`;
  }).join('');
  const detail = [...r.rows].sort((a, b) => SEVERITY[b.category].rank - SEVERITY[a.category].rank).filter((x) => x.category !== 'none').map((x) => `
    <tr><td>${esc(x.structureId)}</td><td>${esc(x.address)}<br><small>${x.lat}, ${x.lon}</small></td><td>${x.type === 'commercial' ? 'Comm.' : 'Res.'}</td>
    <td><span class="sw" style="background:${SEVERITY[x.category].color}"></span>${SEVERITY[x.category].label}</td>
    <td>${x.verified ? '✓ Pilot' : `AI ${Math.round(x.aiConfidence * 100)}%`}</td><td class="num">${money(x.loss)}</td><td>${esc(x.notes)}</td></tr>`).join('');
  const photos = embedImages ? r.rows.filter((x) => x.category === 'destroyed' || x.category === 'major').slice(0, 24).map((x) => {
    const f = state.findings.find((y) => y.id === x.findingId);
    const src = f?.photo || thumb(buildingById(x.structureId), 240, 170);
    return `<figure><img src="${src}" alt=""><figcaption><b>${esc(x.structureId)}</b> ${esc(x.address)} — ${SEVERITY[x.category].label}</figcaption></figure>`;
  }).join('') : '';
  return `
  <article class="report">
    <header class="rp-head">
      <div class="rp-logo">${LOGO_SVG}<div><b>${esc(r.pilot.org)}</b><br><small>UAS Damage Assessment · generated with Kalibr8</small></div></div>
      <div class="rp-id"><b>${esc(r.id)}</b><br><small>Generated ${fmtTime(r.created)}</small></div>
    </header>
    <h1>${esc(T.label)}</h1>
    <p class="rp-sub">Prepared for <b>${esc(r.recipient)}</b></p>
    <section class="rp-grid">
      <div><small>Incident</small><b>${esc(r.incident.name)}</b></div>
      <div><small>Declaration</small><b>${esc(r.incident.declaration)}</b></div>
      <div><small>Jurisdiction</small><b>${esc(r.incident.county)}</b></div>
      <div><small>Area surveyed</small><b>${area.toFixed(1)} ha</b></div>
      <div><small>Structures assessed</small><b>${r.totals.structures}</b></div>
      <div><small>Pilot-verified</small><b>${r.totals.verified} (${r.totals.structures ? Math.round((r.totals.verified / r.totals.structures) * 100) : 0}%)</b></div>
    </section>
    <section class="rp-kpi"><div><small>Damaged structures</small><b>${r.totals.damaged}</b></div><div><small>Destroyed + Major</small><b>${r.totals.bySev.destroyed.count + r.totals.bySev.major.count}</b></div><div class="hl"><small>Estimated loss</small><b>${money(r.totals.cost)}</b></div></section>
    <h2>1. Damage summary</h2>
    <table class="rp-table"><thead><tr><th>Category</th><th>Residential</th><th>Commercial</th><th>Total</th><th class="num">Est. loss</th></tr></thead>
      <tbody>${sumRows}</tbody><tfoot><tr><td>Total</td><td></td><td></td><td>${r.totals.structures}</td><td class="num">${money(r.totals.cost)}</td></tr></tfoot></table>
    <h2>2. Survey area</h2>
    <div class="rp-map">${mapSVG(r)}</div>
    <h2>3. Flight record</h2>
    <table class="rp-table"><thead><tr><th>Flight</th><th>Aircraft</th><th>Time</th><th>Altitude</th><th>Photos</th><th>Area</th></tr></thead><tbody>${flightRows}</tbody></table>
    <p class="rp-small">Remote pilot in command: ${esc(r.pilot.name)}, ${esc(r.pilot.cert)}.</p>
    ${photos ? `<h2>4. Imagery — destroyed and major damage</h2><div class="rp-photos">${photos}</div>` : ''}
    <h2>${photos ? 5 : 4}. Structure detail</h2>
    <table class="rp-table small"><thead><tr><th>ID</th><th>Address / location</th><th>Type</th><th>Category</th><th>Assessed by</th><th class="num">Est. loss</th><th>Notes</th></tr></thead><tbody>${detail}</tbody></table>
    ${r.notes ? `<h2>Notes</h2><p>${esc(r.notes)}</p>` : ''}
    <h2>Methodology</h2>
    <p class="rp-small">Imagery was captured by sUAS in an autonomous grid pattern and processed on the field device with no internet connection. Damage categories follow FEMA PDA terminology (Destroyed, Major, Minor, Affected). Each structure was first categorized by an onboard model, then reviewed by the remote pilot where marked “✓ Pilot”. Estimated loss = assessed value × category factor (Destroyed ${r.factors.destroyed * 100}%, Major ${r.factors.major * 100}%, Minor ${r.factors.minor * 100}%, Affected ${r.factors.affected * 100}%) unless overridden by the pilot. Figures are preliminary and subject to field verification by the reviewing agency.</p>
    <div class="rp-sign"><div><span></span><small>Remote pilot signature / date</small></div><div><span></span><small>Reviewing official / date</small></div></div>
  </article>`;
}

function mapSVG(r) {
  const flights = r.flightIds.map(flightById).filter(Boolean);
  const pts = flights.flatMap((f) => f.poly);
  if (!pts.length) return '';
  const b = bbox(pts); const pad = 40;
  const x0 = b.x - pad, y0 = b.y - pad, w = b.x2 - b.x + pad * 2, hh = b.y2 - b.y + pad * 2;
  const c = city();
  const roads = c.roads.map((rd) => `<line x1="${rd.x1}" y1="${rd.y1}" x2="${rd.x2}" y2="${rd.y2}" stroke="#d9d9d9" stroke-width="${rd.w}"/>`).join('');
  const byB = new Map(r.rows.map((x) => [x.structureId, x.category]));
  const blds = c.buildings.filter((bl) => bl.x > x0 - 20 && bl.x < x0 + w && bl.y > y0 - 20 && bl.y < y0 + hh).map((bl) => {
    const cat = byB.get(bl.id);
    const fill = cat && cat !== 'none' ? SEVERITY[cat].color : '#bdbdbd';
    return `<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" fill="${fill}"/>`;
  }).join('');
  const polys = flights.map((f) => `<polygon points="${f.poly.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#1f5fbf" stroke-width="3" stroke-dasharray="10 6"/>`).join('');
  const legend = SEVERITY_ORDER.slice(0, 4).map((k, i) => `<g transform="translate(${x0 + 12 + i * 120},${y0 + hh - 16})"><rect width="12" height="12" fill="${SEVERITY[k].color}"/><text x="18" y="11" font-size="14" fill="#333">${SEVERITY[k].label}</text></g>`).join('');
  return `<svg viewBox="${x0} ${y0} ${w} ${hh}" xmlns="http://www.w3.org/2000/svg"><rect x="${x0}" y="${y0}" width="${w}" height="${hh}" fill="#f4f4f2"/>${roads}${blds}${polys}<rect x="${x0 + 4}" y="${y0 + hh - 30}" width="490" height="26" fill="#fff" opacity=".85"/>${legend}</svg>`;
}

const LOGO_SVG = '<svg viewBox="304 474 1072 726" width="40" height="27" aria-label="Kalibr8"><path fill-rule="evenodd" fill="#111" d="M482.667 1012.19V1198.33H304V842.222L482.667 1012.19ZM890.934 474C930.267 474 957.913 474 977.268 474.072L586.18 818.757L984.841 1198H758.267L708.533 1149.07C600.8 1043.2 557.466 1002.4 409.333 867.2C393.6 852.801 376.668 837.467 371.867 833.2C366.934 828.934 363.2 824.933 363.467 824.399C364.277 823.191 448.803 750.798 483.867 721.333C575.334 644.533 629.067 596.4 733.601 497.6L758.667 474H890.934ZM1091.14 475.333C1167.42 475.333 1174.81 475.961 1203.12 484.915C1274.84 507.849 1326.59 563.141 1341.21 632.728C1344.99 650.478 1344.99 686.292 1341.21 705.456C1337.91 722.421 1329.26 745.197 1320.14 760.748C1308.03 781.482 1286.95 804.73 1269.18 817.454C1265.88 819.81 1263.36 822.166 1263.68 822.795C1263.83 823.266 1270.44 827.979 1278.15 833.006C1307.71 852.484 1334.14 882.172 1348.92 912.803C1374.24 965.268 1374.87 1026.69 1350.34 1079.94C1322.34 1140.88 1255.18 1186.44 1181.1 1194.61C1172.61 1195.55 1142.57 1196.33 1114.1 1196.33H1071.59L794.804 933.026L803.635 923.17C809.454 916.73 822.351 902.435 832.26 891.597C880.544 839.289 914.045 801.903 914.045 800.646C914.043 799.86 909.955 795.934 905.08 791.693C893.355 781.794 834.996 730.977 806.467 705.916L1068.1 475.333H1091.14ZM1111.12 879.973C1087.68 874.789 1062.99 878.088 1040.97 889.555C1027.91 896.309 1008.41 914.687 1001.33 926.782C985.135 954.585 983.719 988.515 997.56 1016.16C1014.55 1049.78 1045.22 1069.73 1083.28 1071.77C1113.95 1073.5 1139.58 1063.76 1160.97 1042.39C1183.46 1020.09 1193.22 992.285 1189.13 962.754C1183.62 922.698 1151.85 888.926 1111.12 879.973ZM482.667 574.933V639.55L304.005 797.012C304.032 619.92 304.334 474.333 304.334 474.333H482.334L482.667 574.933ZM1110.49 601.783C1087.05 596.757 1062.83 600.212 1040.97 611.521C1025.4 619.533 1006.37 638.697 998.661 654.091C979.63 691.947 986.708 734.831 1016.91 764.833C1035.46 783.211 1056.38 792.322 1083.28 793.735C1113.95 795.463 1139.58 785.724 1160.97 764.361C1196.83 728.704 1199.66 676.554 1168.05 636.655C1154.68 619.848 1132.51 606.339 1110.49 601.783Z"/></svg>';

// ---------------- preview / export / send ----------------
export function openPreview(app, r) {
  const paper = h('div', { class: 'paper', html: reportHTML(r) });
  const m = modal({
    title: `${REPORT_TYPES[r.type].short} · ${r.id}`, wide: true, cls: 'preview',
    body: paper,
    footer: [
      h('span', { class: `chip chip-status s-${STATUS[r.status][1]}` }, STATUS[r.status][0]),
      h('span', { class: 'grow' }),
      btn('PDF / Print', { variant: 'dark', icon: 'print', onClick: () => printReport(r) }),
      btn('CSV', { variant: 'dark', icon: 'download', onClick: () => download(`${r.id}-structures.csv`, toCSV(r), 'text/csv') }),
      btn('GeoJSON', { variant: 'dark', icon: 'download', onClick: () => download(`${r.id}.geojson`, toGeoJSON(r), 'application/geo+json') }),
      btn('Share / AirDrop', { variant: 'dark', icon: 'share', onClick: () => shareReport(r) }),
      r.status === 'delivered' ? null : btn(r.status === 'queued' ? 'Queued' : `Send to ${shortRecipient(r.recipient)}`, { icon: 'send', disabled: r.status === 'queued' || r.status === 'sending', onClick: () => { send(app, r); m.close(); } }),
    ],
  });
}
const shortRecipient = (s) => s.split('—')[0].trim();

function send(app, r) {
  if (app.isOnline()) { deliver(app, r); toast(`Sending ${r.id}…`); }
  else { r.status = 'queued'; r.queuedAt = Date.now(); emit('report'); toast('Offline — report queued. It will send automatically when a connection is available.', 'warn'); }
}

async function deliver(app, r) {
  r.status = 'sending'; emit('report');
  const endpoint = state.settings.endpoint;
  try {
    if (endpoint) {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, html: reportHTML(r, { embedImages: false }) }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else {
      await new Promise((res) => setTimeout(res, 1800)); // prototype: simulated submission
    }
    r.status = 'delivered'; r.deliveredAt = Date.now();
    toast(`${r.id} delivered to ${shortRecipient(r.recipient)}`, 'ok');
  } catch (e) {
    r.status = 'failed'; toast(`Send failed (${e.message}). Will retry.`, 'err');
  }
  emit('report');
}

let busy = false;
export async function processOutbox(app) {
  if (busy || !app.isOnline()) return;
  const q = state.reports.filter((r) => r.status === 'queued' || r.status === 'failed');
  if (!q.length) return;
  busy = true;
  for (const r of q) await deliver(app, r);
  busy = false;
}

function toCSV(r) {
  const cols = ['report_id', 'structure_id', 'address', 'latitude', 'longitude', 'structure_type', 'damage_category', 'ai_category', 'ai_confidence', 'pilot_verified', 'assessed_value_usd', 'estimated_loss_usd', 'notes', 'flight_id', 'captured_at'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = r.rows.map((x) => [r.id, x.structureId, x.address, x.lat, x.lon, x.type, SEVERITY[x.category].label, SEVERITY[x.aiCategory].label, x.aiConfidence, x.verified ? 'yes' : 'no', x.value, x.loss, x.notes, x.flightId, new Date(x.capturedAt).toISOString()].map(q).join(','));
  return [cols.join(','), ...lines].join('\n');
}
function toGeoJSON(r) {
  return JSON.stringify({
    type: 'FeatureCollection',
    properties: { report_id: r.id, incident: r.incident, generated: new Date(r.created).toISOString(), recipient: r.recipient },
    features: [
      ...r.flightIds.map(flightById).filter(Boolean).map((f) => ({ type: 'Feature', properties: { kind: 'survey_area', flight_id: f.id, name: f.name }, geometry: { type: 'Polygon', coordinates: [[...f.poly, f.poly[0]].map(([x, y]) => { const c = toLatLon(x, y); return [+c.lon.toFixed(6), +c.lat.toFixed(6)]; })] } })),
      ...r.rows.map((x) => ({ type: 'Feature', properties: { kind: 'structure', id: x.structureId, address: x.address, category: x.category, verified: x.verified, estimated_loss_usd: x.loss, notes: x.notes }, geometry: { type: 'Point', coordinates: [x.lon, x.lat] } })),
    ],
  }, null, 2);
}

function standaloneHTML(r) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${r.id}</title><style>${REPORT_CSS}</style></head><body>${reportHTML(r)}</body></html>`;
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Saved ${name}`);
}

async function shareReport(r) {
  const files = [
    new File([standaloneHTML(r)], `${r.id}-report.html`, { type: 'text/html' }),
    new File([toCSV(r)], `${r.id}-structures.csv`, { type: 'text/csv' }),
  ];
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: `${REPORT_TYPES[r.type].short} ${r.id}` }); } catch (e) { /* cancelled */ }
  } else {
    download(`${r.id}-report.html`, standaloneHTML(r), 'text/html');
  }
}

function printReport(r) {
  const root = document.getElementById('print-root');
  root.innerHTML = reportHTML(r);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

// Shared with the print stylesheet and the standalone HTML export.
export const REPORT_CSS = `
.report{font:12px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;color:#1d1d1f;max-width:820px;margin:0 auto;padding:32px;background:#fff}
.report h1{font-size:20px;margin:18px 0 4px}.report h2{font-size:14px;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.report small{color:#666}.rp-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1d1d1f;padding-bottom:12px}
.rp-logo{display:flex;gap:10px;align-items:center}.rp-id{text-align:right}.rp-sub{margin:0 0 12px;color:#444}
.rp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.rp-grid div,.rp-kpi div{background:#f5f5f7;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column}
.rp-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rp-kpi b{font-size:20px}.rp-kpi .hl{background:#1d1d1f;color:#fff}.rp-kpi .hl small{color:#bbb}
.rp-table{width:100%;border-collapse:collapse;font-size:11.5px}.rp-table th{text-align:left;background:#f0f0f0;font-weight:600;padding:6px}.rp-table td{border-bottom:1px solid #e6e6e6;padding:6px;vertical-align:top}
.rp-table tfoot td{font-weight:700;border-top:2px solid #1d1d1f}.rp-table.small{font-size:10.5px}.num{text-align:right;white-space:nowrap}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.rp-map svg{width:100%;height:auto;border:1px solid #ddd;border-radius:6px}.rp-small{font-size:10.5px;color:#444}
.rp-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.rp-photos figure{margin:0;break-inside:avoid}.rp-photos img{width:100%;border-radius:4px;display:block}.rp-photos figcaption{font-size:9.5px;color:#444;margin-top:2px}
.rp-sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}.rp-sign span{display:block;border-bottom:1px solid #1d1d1f;height:36px}
tr{break-inside:avoid}.rp-map{break-inside:avoid}.report h2{break-after:avoid}
`;
