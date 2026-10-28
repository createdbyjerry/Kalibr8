// Procedural "aerial imagery" renderer used for the simulated live feed and
// for damage thumbnails. Swap for real frames from the drone SDK / SD card.
import { city, rng } from './geo.js';

const ROOFS = ['#9a5b45', '#6d6f73', '#c9c4b8', '#a08664'];
const COMM_ROOFS = ['#8c8f94', '#b5b8bb', '#77797c', '#a3a6a1'];

function drawGround(ctx, x0, y0, x1, y1) {
  const c = city();
  ctx.fillStyle = '#56653d';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // blocks (yards / lots)
  c.blocks.forEach((b, i) => {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) return;
    ctx.fillStyle = b.kind === 'park' ? '#4d6b35' : b.kind === 'commercial' ? '#7d7a72' : '#5f6e42';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // trees
    const r = rng(i * 7919 + 13);
    const n = b.kind === 'park' ? 40 : 14;
    for (let k = 0; k < n; k++) {
      const tx = b.x + r() * b.w, ty = b.y + r() * b.h, tr = 2.5 + r() * 3.5;
      ctx.fillStyle = r() < 0.25 ? '#6e5a3a' : '#3b5326';
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
    }
  });
  // roads
  c.roads.forEach((rd) => {
    ctx.strokeStyle = rd.rail ? '#5a5047' : '#3e3f41';
    ctx.lineWidth = rd.w;
    ctx.beginPath(); ctx.moveTo(rd.x1, rd.y1); ctx.lineTo(rd.x2, rd.y2); ctx.stroke();
    if (!rd.rail && rd.w > 12) {
      ctx.strokeStyle = '#b9a560'; ctx.lineWidth = 0.4; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(rd.x1, rd.y1); ctx.lineTo(rd.x2, rd.y2); ctx.stroke(); ctx.setLineDash([]);
    }
  });
}

function drawBuilding(ctx, b) {
  const r = rng(b.seed);
  const roofs = b.type === 'commercial' ? COMM_ROOFS : ROOFS;
  const roof = roofs[b.roofHue];
  const sev = b.severity;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(b.x + 1.5, b.y + 1.5, b.w, b.h);
  if (sev !== 'destroyed') {
    ctx.fillStyle = roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // ridge line
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.4;
    ctx.beginPath();
    if (b.w > b.h) { ctx.moveTo(b.x, b.y + b.h / 2); ctx.lineTo(b.x + b.w, b.y + b.h / 2); } else { ctx.moveTo(b.x + b.w / 2, b.y); ctx.lineTo(b.x + b.w / 2, b.y + b.h); }
    ctx.stroke();
  }
  const debris = (count, spread, palette) => {
    for (let k = 0; k < count; k++) {
      const dx = b.x - spread + r() * (b.w + spread * 2), dy = b.y - spread + r() * (b.h + spread * 2);
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(r() * Math.PI);
      ctx.fillRect(-0.4, -0.4, 0.6 + r() * 2.6, 0.4 + r() * 1.2);
      ctx.restore();
    }
  };
  const DEB = ['#d9d2c3', '#8a6b4b', '#b7b2a8', '#5b4a3a', roof];
  if (sev === 'affected') debris(10, 6, DEB);
  if (sev === 'minor') {
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#2d2a26'; ctx.fillRect(b.x + r() * b.w * 0.8, b.y + r() * b.h * 0.8, b.w * 0.15, b.h * 0.12); }
    debris(26, 8, DEB);
  }
  if (sev === 'major') {
    if (r() < 0.6) { ctx.fillStyle = '#2f6fb3'; ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.1, b.w * 0.55, b.h * 0.5); }
    ctx.fillStyle = '#231f1b'; ctx.fillRect(b.x + b.w * (0.4 + r() * 0.3), b.y + b.h * 0.45, b.w * 0.3, b.h * 0.35);
    debris(60, 12, DEB);
  }
  if (sev === 'destroyed') {
    ctx.fillStyle = '#6f6455'; ctx.fillRect(b.x, b.y, b.w, b.h);
    debris(160, 4, ['#d9d2c3', '#8a6b4b', '#b7b2a8', '#5b4a3a', '#3a332b', '#e8e2d4']);
    debris(70, 18, DEB);
    // fallen trees
    ctx.strokeStyle = '#4a3a26'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) { const tx = b.x + r() * b.w, ty = b.y + b.h + 3 + r() * 6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 8 - r() * 16, ty + 4); ctx.stroke(); }
  }
}

// Draw a top-down frame. (cx, cy) world centre, scale = px per metre.
export function renderAerial(ctx, cx, cy, scale, w, h, opts = {}) {
  ctx.save();
  ctx.fillStyle = '#56653d'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  if (opts.heading != null) ctx.rotate(-opts.heading - Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  const R = Math.hypot(w, h) / scale / 2 + 20;
  drawGround(ctx, cx - R, cy - R, cx + R, cy + R);
  city().buildings.forEach((b) => { if (Math.abs(b.x - cx) < R && Math.abs(b.y - cy) < R) drawBuilding(ctx, b); });
  ctx.restore();
  if (opts.grain) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

const thumbCache = new Map();
export function thumb(b, w = 240, hgt = 170) {
  const key = `${b.id}-${w}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const cv = document.createElement('canvas');
  const dpr = 2;
  cv.width = w * dpr; cv.height = hgt * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const scale = Math.min(w / (b.w * 2.4), hgt / (b.h * 2.4));
  renderAerial(ctx, b.x + b.w / 2, b.y + b.h / 2, scale, w, hgt, { grain: true });
  // detection box
  ctx.strokeStyle = '#3F8CFF'; ctx.lineWidth = 1.5;
  const bw = b.w * scale + 10, bh = b.h * scale + 10;
  ctx.strokeRect(w / 2 - bw / 2, hgt / 2 - bh / 2, bw, bh);
  const url = cv.toDataURL('image/jpeg', 0.82);
  thumbCache.set(key, url);
  return url;
}
