// Step 1 — connect the drone over a direct, internet-free link.
import { state, ui } from '../store.js';
import { connect, disconnect, scan, live } from '../sim.js';
import { h, icon, btn, batteryChip, signalChip, statusChip, toast, drawerHeader, fmtTime } from '../ui.js';

const METHODS = [
  { id: 'usb', icon: 'usb', label: 'Controller', sub: 'USB-C cable' },
  { id: 'wifi', icon: 'wifi', label: 'Drone Wi-Fi', sub: 'Aircraft hotspot' },
  { id: 'ble', icon: 'bluetooth', label: 'Bluetooth', sub: 'Low energy' },
];
let method = 'usb';
let scanning = false;
let scanned = false;
let busy = null;
let open = null;

export function droneImage(d, size = 'md') {
  // Placeholder silhouettes — replace with product photos in your repo if licensed.
  const art = {
    quad: '<svg viewBox="0 0 120 100"><g fill="#2b2b2b"><ellipse cx="60" cy="52" rx="16" ry="10"/><rect x="20" y="47" width="80" height="4" rx="2"/><rect x="40" y="38" width="40" height="4" rx="2" transform="rotate(25 60 40)"/><rect x="40" y="58" width="40" height="4" rx="2" transform="rotate(-25 60 60)"/></g><g fill="#555"><ellipse cx="20" cy="45" rx="14" ry="2"/><ellipse cx="100" cy="45" rx="14" ry="2"/><ellipse cx="32" cy="66" rx="14" ry="2"/><ellipse cx="88" cy="66" rx="14" ry="2"/></g><circle cx="60" cy="61" r="4" fill="#111"/></svg>',
    wing: '<svg viewBox="0 0 120 100"><path d="M60 14 L112 78 L80 72 L60 86 L40 72 L8 78 Z" fill="#1d1d1d"/><path d="M60 14 L66 50 L60 60 L54 50 Z" fill="#c9a227"/><path d="M60 14 L78 46 M60 14 L42 46" stroke="#c9a227" stroke-width="1.5"/></svg>',
    quad2: '<svg viewBox="0 0 120 100"><g fill="#cfcfcf" stroke="#9a9a9a"><rect x="44" y="40" width="32" height="20" rx="6"/><path d="M10 50 H110" stroke-width="3"/></g><g fill="#888"><ellipse cx="14" cy="44" rx="12" ry="2"/><ellipse cx="106" cy="44" rx="12" ry="2"/></g><circle cx="60" cy="64" r="5" fill="#333"/></svg>',
  }[d.kind] || '';
  return h('div', { class: `drone-img ${size}`, html: art });
}

export function droneSpecs(d) {
  return h('div', { class: 'specs' },
    h('div', { class: 'spec-name' }, d.name),
    h('div', {}, `Serial Number: ${d.serial}`),
    h('div', {}, `Primary sensor: ${d.sensor}`),
    h('div', {}, `Flight time: ~${d.flightMin} min`),
    h('div', {}, `Weight: ${d.weight}`));
}

export function render(app) {
  const connected = state.connectedId;
  const doScan = async () => {
    scanning = true; app.rerender();
    await scan();
    scanning = false; scanned = true; app.rerender();
  };
  if (!scanned && !scanning) setTimeout(doScan, 50);

  const list = state.drones.map((d) => {
    const isConn = connected === d.id;
    const expanded = open === d.id || isConn;
    return h('div', { class: `drone-row ${isConn ? 'connected' : ''} ${!d.available ? 'unavailable' : ''} ${expanded ? 'open' : ''}`, onclick: () => { open = open === d.id ? null : d.id; app.rerender(); } },
      h('div', { class: 'drone-main' },
        droneImage(d),
        droneSpecs(d),
        h('div', { class: 'chip-col' },
          isConn ? statusChip('live') : !d.available ? statusChip('off') : null,
          batteryChip(d.battery, d.available),
          signalChip(d.available ? d.signal : 'none'))),
      expanded ? h('div', { class: 'drone-detail', onclick: (e) => e.stopPropagation() },
        isConn ? [
          h('div', { class: 'kv-grid' },
            kv('Link', METHODS.find((m) => m.id === state.link?.method)?.label + ' · encrypted'),
            kv('Linked since', fmtTime(state.link?.since).slice(11)),
            kv('Firmware', d.firmware),
            kv('GPS', `${d.sats} satellites · 3D fix`),
            kv('Storage', `${d.storageGB} GB free`),
            kv('Home point', 'Set at launch site')),
          h('div', { class: 'row-actions' },
            btn('Disconnect', { variant: 'dark', small: true, onClick: () => { disconnect(); toast(`${d.name} disconnected`); } }),
            btn('Plan a flight', { small: true, icon: 'arrow', onClick: () => app.go('flights') })),
        ] : d.available ? h('div', { class: 'row-actions' },
          h('span', { class: 'muted small' }, d.battery <= 20 ? 'Low battery — swap before a long mission.' : 'Ready to link.'),
          btn(busy === d.id ? 'Connecting…' : 'Connect', { small: true, disabled: !!busy, onClick: async () => {
            busy = d.id; app.rerender();
            try {
              if (connected) disconnect();
              await connect(d.id, method);
              toast(`Linked to ${d.name} via ${METHODS.find((m) => m.id === method).label}`, 'ok');
            } catch (err) { toast(err.message, 'err'); }
            busy = null; open = null; app.rerender();
          } }))
          : h('div', { class: 'row-actions' }, h('span', { class: 'muted small' }, 'Not responding. Power it on, or move closer, then scan again.')),
      ) : null);
  });

  return h('div', { class: 'drawer-inner' },
    drawerHeader('Drone Details'),
    h('div', { class: 'drawer-body' },
      h('div', { class: 'section pad' },
        h('div', { class: 'eyebrow' }, 'Connection method'),
        h('div', { class: 'seg' }, METHODS.map((m) => h('button', { class: `seg-btn ${method === m.id ? 'active' : ''}`, onclick: () => { method = m.id; app.rerender(); } }, icon(m.icon), h('span', {}, h('b', {}, m.label), h('small', {}, m.sub))))),
        h('p', { class: 'muted small' }, 'Direct link to the aircraft — no internet, cell service or cloud account needed.')),
      h('div', { class: 'list-head' }, h('span', {}, scanning ? 'Searching for aircraft…' : `${state.drones.filter((d) => d.available).length} aircraft found`),
        btn(scanning ? '' : 'Scan', { variant: 'dark', small: true, icon: 'refresh', cls: scanning ? 'spin' : '', disabled: scanning, onClick: doScan })),
      scanning && !scanned ? h('div', { class: 'scan-anim' }, h('i'), h('i'), h('i')) : list),
    connected ? h('div', { class: 'drawer-foot' }, btn('Next: plan flight', { icon: 'arrow', onClick: () => app.go('flights') })) : null,
  );
}

function kv(k, v) { return h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v)); }
