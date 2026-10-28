// Live telemetry bar, mission controls and the picture-in-picture camera feed.
import { state, ui, flightById, droneById, emit } from '../store.js';
import { live, pause, resume, stop, swapBattery } from '../sim.js';
import { h, icon, btn, batteryChip, signalChip, fmtDur, fmtTime } from '../ui.js';
import { renderAerial } from '../feed.js';

const hud = document.getElementById('hud');
const pip = document.getElementById('pip');
const canvas = pip.querySelector('canvas');
const pipMeta = pip.querySelector('.pip-meta');
let lastKey = '';

pip.addEventListener('click', () => pip.classList.toggle('big'));

export function renderHud(app) {
  const f = flightById(live.flightId);
  pip.hidden = !f;
  if (!f) { hud.hidden = true; hud.replaceChildren(); lastKey = ''; return; }
  hud.hidden = false;
  const d = droneById(f.droneId);
  const total = live.plan.length;
  const pct = Math.min(100, (f.progress / total) * 100);
  const found = state.findings.filter((x) => x.flightId === f.id);
  const dmg = found.filter((x) => x.severity !== 'none').length;
  const key = `${live.running}-${live.alert?.kind}-${ui.annotateMode}-${state.settings.simSpeed}`;
  const stats = [
    ['ALT', `${live.alt.toFixed(1)} m`],
    ['SPD', `${live.speed.toFixed(1)} m/s`],
    ['PHOTOS', `${f.photos}`],
    ['STRUCTURES', `${found.length}`],
    ['DAMAGED', `${dmg}`],
    ['ETA', fmtDur(Math.max(0, (total - f.progress) / f.params.speed))],
  ];
  // Rebuild controls only when their state changes; numbers update every tick.
  if (key !== lastKey) {
    lastKey = key;
    hud.replaceChildren(...[
      h('div', { class: 'hud-top' },
        h('div', { class: 'hud-title' }, h('span', { class: `live-dot ${live.running ? '' : 'paused'}` }), h('b', {}, f.name), h('span', { class: 'muted' }, live.running ? ' · Autonomous mission' : ' · Holding')),
        h('div', { class: 'hud-chips' }, h('span', { class: 'hud-batt' }), h('span', { class: 'hud-sig' }))),
      h('div', { class: 'hud-stats' }, stats.map(([k]) => h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v', 'data-k': k })))),
      h('div', { class: 'hud-progress' }, h('i')),
      live.alert ? h('div', { class: `hud-alert ${live.alert.kind}` }, icon(live.alert.kind === 'done' ? 'check' : 'warning'), h('span', {}, live.alert.text)) : null,
      h('div', { class: 'hud-actions' },
        live.alert?.kind === 'done'
          ? [btn('Review damage', { icon: 'arrow', onClick: () => { stop(); ui.annotateMode = false; app.go('review'); } })]
          : live.alert?.kind === 'battery'
            ? [btn('Battery swapped — resume', { icon: 'refresh', onClick: () => swapBattery() }), btn('End mission', { variant: 'dark', icon: 'land', onClick: () => { stop(); } })]
            : [
              live.running ? btn('Hold', { variant: 'dark', icon: 'pause', onClick: pause }) : btn('Resume', { icon: 'play', onClick: resume }),
              btn('Return home', { variant: 'dark', icon: 'home', onClick: () => { stop(); } }),
              btn(ui.annotateMode ? 'Annotating' : 'Annotate', { variant: ui.annotateMode ? 'primary' : 'dark', icon: 'addLocation', onClick: () => { ui.annotateMode = !ui.annotateMode; app.rerender(); } }),
              h('label', { class: 'sim-speed', title: 'Simulation speed (prototype only)' }, 'Sim ×',
                h('select', { onchange: (e) => { state.settings.simSpeed = +e.target.value; emit('settings'); } }, [1, 5, 10, 25, 50].map((v) => h('option', { value: v, selected: v === state.settings.simSpeed }, v)))),
            ]),
    ].filter(Boolean));
  }
  stats.forEach(([k, v]) => { const el = hud.querySelector(`[data-k="${k}"]`); if (el) el.textContent = v; });
  hud.querySelector('.hud-progress i').style.width = `${pct}%`;
  hud.querySelector('.hud-batt').replaceChildren(batteryChip(Math.round(live.battery)));
  hud.querySelector('.hud-sig').replaceChildren(signalChip(live.signal));
  pipMeta.textContent = `LIVE · EO · ${fmtTime(Date.now()).slice(11)} · ${live.alt.toFixed(0)}m AGL`;
}

export function renderFeed() {
  if (!live.pos || pip.hidden) return;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = r.width / (live.plan.footW * 1.05);
  renderAerial(ctx, live.pos.x, live.pos.y, scale, r.width, r.height, { heading: live.pos.heading, grain: true });
  // crosshair
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
  const cx = r.width / 2, cy = r.height / 2;
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
}
