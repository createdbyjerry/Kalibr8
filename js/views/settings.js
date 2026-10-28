import { state, emit, reset, loadSample, ui } from '../store.js';
import { h, btn, modal, field, toast, confirmDialog } from '../ui.js';

export function openSettings(app) {
  const s = state.settings;
  const inp = (obj, key, type = 'text') => h('input', { class: 'input', type, value: obj[key], onchange: (e) => { obj[key] = type === 'number' ? +e.target.value : e.target.value; emit('settings'); } });
  const pctIn = (key) => h('input', { class: 'input', type: 'number', min: 0, max: 100, value: Math.round(s.factors[key] * 100), onchange: (e) => { s.factors[key] = +e.target.value / 100; emit('settings'); } });
  const m = modal({
    title: 'Settings', cls: 'settings',
    body: h('div', { class: 'stack' },
      h('div', { class: 'eyebrow' }, 'Remote pilot'),
      h('div', { class: 'grid2' }, field('Name', inp(s.pilot, 'name')), field('Certificate', inp(s.pilot, 'cert'))),
      field('Organization', inp(s.pilot, 'org')),
      h('div', { class: 'eyebrow' }, 'Loss estimate factors (% of assessed value)'),
      h('div', { class: 'grid4' }, field('Destroyed', pctIn('destroyed')), field('Major', pctIn('major')), field('Minor', pctIn('minor')), field('Affected', pctIn('affected'))),
      h('div', { class: 'eyebrow' }, 'Delivery'),
      field('Report endpoint (optional)', h('input', { class: 'input', type: 'url', placeholder: 'https://… — leave blank to simulate delivery', value: s.endpoint || '', onchange: (e) => { s.endpoint = e.target.value.trim(); emit('settings'); } }), 'Queued reports are POSTed here as JSON once the device is online.'),
      field('Network mode', h('select', { class: 'input', onchange: (e) => { s.network = e.target.value; emit('settings'); app.rerender(); } },
        [['auto', 'Automatic (use device connection)'], ['offline', 'Force offline (demo)'], ['online', 'Force online (demo)']].map(([v, l]) => h('option', { value: v, selected: s.network === v }, l)))),
      h('div', { class: 'eyebrow' }, 'Prototype'),
      field('Flight simulation speed', h('select', { class: 'input', onchange: (e) => { s.simSpeed = +e.target.value; emit('settings'); } }, [1, 5, 10, 25, 50].map((v) => h('option', { value: v, selected: s.simSpeed === v }, `${v}×`)))),
      h('div', { class: 'row-actions' },
        btn('Load sample survey', { variant: 'dark', small: true, onClick: () => { const f = loadSample(); ui.selectedFlight = f.id; m.close(); toast('Sample survey loaded'); app.go('review'); } }),
        btn('Reset all data', { variant: 'danger', small: true, onClick: async () => { if (await confirmDialog('Reset all data?', 'Flights, findings, annotations and reports on this device will be erased.', 'Reset')) { reset(); m.close(); location.reload(); } } }))),
  });
}
