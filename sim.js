// Drone link + mission simulator. In production this module is replaced by the
// controller bridge (MAVLink / vendor SDK) — the rest of the app only uses this API.
import { state, emit, planFor, droneById, mkFinding, flightById } from './store.js';
import { pathPointAt, buildingsIn } from './geo.js';

const subs = new Set();
export const live = { flightId: null, running: false, pos: null, plan: null, battery: 100, signal: 'strong', alt: 0, speed: 0, photos: 0, lastSave: 0, seen: new Set(), alert: null };

export function onTick(fn) { subs.add(fn); return () => subs.delete(fn); }
const tickAll = () => subs.forEach((fn) => fn(live));

// ---- link ----
export function scan() {
  return new Promise((res) => setTimeout(() => res(state.drones), 1400));
}
export async function connect(droneId, method) {
  const d = droneById(droneId);
  if (!d.available) throw new Error(`${d.name} is not responding. Check that it is powered on and in range.`);
  await new Promise((r) => setTimeout(r, 1600));
  state.connectedId = droneId;
  state.link = { method, since: Date.now() };
  emit('link');
  return d;
}
export function disconnect() {
  if (live.running) stop();
  state.connectedId = null; state.link = null; emit('link');
}

// ---- mission ----
let raf = null, last = 0;
export function start(flightId) {
  const f = flightById(flightId);
  const d = droneById(f.droneId);
  live.flightId = flightId;
  live.plan = planFor(f);
  live.battery = d.battery;
  live.seen = new Set(state.findings.filter((x) => x.flightId === flightId).map((x) => x.buildingId));
  live.candidates = buildingsIn(f.poly).map((b) => ({ b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }));
  live.alert = null;
  if (f.status !== 'in-progress') { f.status = 'in-progress'; f.start = f.start || Date.now(); f.progress = f.progress || 0; }
  live.running = true;
  emit('flight');
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}
export function pause() { live.running = false; cancelAnimationFrame(raf); emit('flight'); tickAll(); }
export function resume() { if (!live.flightId) return; live.alert = null; live.running = true; last = performance.now(); raf = requestAnimationFrame(loop); emit('flight'); }
export function swapBattery() { live.battery = 100; const d = droneById(flightById(live.flightId).droneId); d.battery = 100; resume(); }
export function stop() {
  live.running = false; cancelAnimationFrame(raf);
  const f = flightById(live.flightId);
  if (f && f.status === 'in-progress') f.status = 'paused';
  live.flightId = null; live.pos = null;
  emit('flight'); tickAll();
}

function loop(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  const f = flightById(live.flightId);
  if (!f || !live.running) return;
  const k = state.settings.simSpeed;
  const dt = dtReal * k;
  const d = droneById(f.droneId);
  f.progress += f.params.speed * dt;
  const p = pathPointAt(live.plan.wps, f.progress);
  live.pos = p;
  live.alt = f.params.altitude + Math.sin(now / 900) * 0.4;
  live.speed = f.params.speed + Math.sin(now / 700) * 0.3;
  const trigger = live.plan.footW * (d.aspect ?? 0.75) * (1 - f.params.frontlap / 100);
  f.photos = Math.floor(f.progress / trigger);
  live.battery = Math.max(0, live.battery - (dt / (d.flightMin * 60)) * 100);
  d.battery = Math.round(live.battery);
  const distHome = Math.hypot(p.x - live.plan.wps[0][0], p.y - live.plan.wps[0][1]);
  live.signal = distHome > 700 ? 'weak' : 'strong';
  // "Onboard AI" detections as the camera footprint passes over structures
  const half = live.plan.footW / 2;
  live.candidates.forEach(({ b, cx, cy }) => {
    if (live.seen.has(b.id)) return;
    if (Math.abs(cx - p.x) < half && Math.abs(cy - p.y) < half * 0.75) {
      live.seen.add(b.id);
      state.findings.push(mkFinding(f, b, Date.now()));
      live.newFinding = true;
    }
  });
  if (p.done) {
    live.running = false;
    f.status = 'completed'; f.end = Date.now();
    live.alert = { kind: 'done', text: 'Mission complete. Drone returned home and landed.' };
    emit('flight'); tickAll();
    return;
  }
  if (live.battery <= 22) {
    live.running = false;
    live.alert = { kind: 'battery', text: `Battery at ${Math.round(live.battery)}%. Drone is returning home — swap the battery to resume the mission where it left off.` };
    emit('flight'); tickAll();
    return;
  }
  if (now - live.lastSave > 1000 || live.newFinding) { live.lastSave = now; live.newFinding = false; emit('tick'); }
  tickAll();
  raf = requestAnimationFrame(loop);
}
