// Geometry, the offline basemap generator, and survey-grid math.
// World units are metres on a local plane: x grows east, y grows south (SVG space).

export const WORLD = { w: 2370, h: 1600 };
export const ORIGIN = { lat: 25.8010, lon: -80.2010 }; // top-left corner of the local plane
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function toLatLon(x, y) {
  return { lat: ORIGIN.lat - y / M_PER_DEG_LAT, lon: ORIGIN.lon + x / M_PER_DEG_LON };
}

export function fmtDMS(x, y, alt) {
  const { lat, lon } = toLatLon(x, y);
  const dms = (v, pos, neg) => {
    const s = v >= 0 ? pos : neg;
    v = Math.abs(v);
    const d = Math.floor(v);
    const mF = (v - d) * 60;
    const m = Math.floor(mF);
    const sec = ((mF - m) * 60).toFixed(2);
    return `${d}°${m}′${sec}″${s}`;
  };
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}${alt != null ? ` ${alt.toFixed(1)}m` : ''}`;
}

export function fmtLatLon(x, y) {
  const { lat, lon } = toLatLon(x, y);
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// Deterministic RNG so the basemap and damage are identical on every device.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AVENUES = ['NW 7th Ave', 'NW 6th Ave', 'NW 5th Ave', 'NW 4th Ave', 'NW 3rd Ave', 'NW 2nd Ave', 'NW 1st Ave', 'N Miami Ave', 'NE 1st Ave', 'NE 2nd Ave', 'NE 3rd Ave', 'NE 4th Ave', 'NE 5th Ave', 'NE 6th Ave', 'NE 7th Ave', 'NE 8th Ave'];
const STREETS = ['NW 23rd St', 'NW 22nd St', 'NW 21st St', 'NW 20th St', 'NW 19th St', 'NW 18th St', 'NW 17th St', 'NW 16th St', 'NW 15th St', 'NW 14th St', 'NW 13th St'];

export const SEVERITY = {
  destroyed: { label: 'Destroyed', color: '#E5484D', factor: 1.0, rank: 4 },
  major: { label: 'Major', color: '#FF9800', factor: 0.5, rank: 3 },
  minor: { label: 'Minor', color: '#F5D90A', factor: 0.15, rank: 2 },
  affected: { label: 'Affected', color: '#65A3FF', factor: 0.05, rank: 1 },
  none: { label: 'No visible damage', color: '#9E9E9E', factor: 0, rank: 0 },
};
export const SEVERITY_ORDER = ['destroyed', 'major', 'minor', 'affected', 'none'];

let _city = null;
export function city() {
  if (_city) return _city;
  const r = rng(20261028);
  const avX = AVENUES.map((_, i) => 60 + i * 150);
  const stY = STREETS.map((_, j) => 50 + j * 150);
  const roads = [];
  avX.forEach((x, i) => roads.push({ name: AVENUES[i], x1: x, y1: 0, x2: x, y2: WORLD.h, w: i === 7 ? 16 : 10 }));
  stY.forEach((y, j) => roads.push({ name: STREETS[j], x1: 0, y1: y, x2: WORLD.w, y2: y, w: j === 3 || j === 6 ? 16 : 10 }));
  // A diagonal rail corridor, like the figma basemap.
  roads.push({ name: '', x1: 1420, y1: 0, x2: 1120, y2: WORLD.h, w: 6, rail: true });

  const blocks = [];
  const buildings = [];
  let n = 1;
  for (let i = 0; i < avX.length - 1; i++) {
    for (let j = 0; j < stY.length - 1; j++) {
      const x = avX[i] + 9, y = stY[j] + 9;
      const w = avX[i + 1] - avX[i] - 18, h = stY[j + 1] - stY[j] - 18;
      const roll = r();
      const kind = roll < 0.08 ? 'park' : roll < 0.24 ? 'commercial' : 'residential';
      blocks.push({ x, y, w, h, kind });
      if (kind === 'park') continue;
      if (kind === 'commercial') {
        const cnt = 1 + Math.floor(r() * 3);
        const bw = (w - 10) / cnt;
        for (let k = 0; k < cnt; k++) {
          const bh = h * (0.45 + r() * 0.35);
          buildings.push(mkBuilding(n++, x + 5 + k * bw + 3, y + (h - bh) / 2, bw - 6, bh, 'commercial', avX[i], stY[j], r));
        }
        continue;
      }
      // residential: two rows of lots
      const lots = Math.floor(w / 26);
      const lotW = w / lots;
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < lots; k++) {
          if (r() < 0.1) continue; // empty lot
          const bw = lotW * (0.5 + r() * 0.2);
          const bh = h / 2 * (0.42 + r() * 0.2);
          const bx = x + k * lotW + (lotW - bw) / 2;
          const by = row === 0 ? y + 8 + r() * 4 : y + h - bh - 8 - r() * 4;
          buildings.push(mkBuilding(n++, bx, by, bw, bh, 'residential', avX[i], stY[j], r));
        }
      }
    }
  }
  // Hurricane damage: worse near the storm's swath running NE→SW through the area.
  buildings.forEach((b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = Math.abs(0.55 * cx + cy - 1500) / Math.hypot(0.55, 1); // distance to swath line
    const intensity = Math.max(0, 1 - d / 460) * 0.8 + r() * 0.32;
    b.severity = intensity > 0.94 ? 'destroyed' : intensity > 0.8 ? 'major' : intensity > 0.6 ? 'minor' : intensity > 0.42 ? 'affected' : 'none';
    b.roofHue = Math.floor(r() * 4);
    b.seed = Math.floor(r() * 1e9);
  });
  _city = { roads, blocks, buildings, avX, stY };
  return _city;
}

function mkBuilding(n, x, y, w, h, type, avx, sty, r) {
  const value = type === 'commercial' ? Math.round((650 + r() * 1400) / 5) * 5000 : Math.round((210 + r() * 160) / 5) * 5000;
  const ci = AVENUES.length; // street numbers from position
  const num = 1400 + Math.round(((WORLD.h - sty) / 150) * 100) + Math.floor(r() * 90);
  const ave = AVENUES[Math.min(ci - 1, Math.max(0, Math.round((avx - 60) / 150)))];
  return { id: `S-${String(n).padStart(4, '0')}`, x, y, w, h, type, value, address: `${num} ${ave}`, stories: type === 'commercial' ? 1 + Math.floor(r() * 3) : 1 };
}

// ---- polygon helpers ----
export function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

export function bbox(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

// Lawnmower grid clipped to the polygon. Returns waypoints and survey estimates.
export function surveyPlan(poly, params, drone) {
  if (!poly || poly.length < 3) return null;
  const hfov = ((drone?.hfov ?? 69) * Math.PI) / 180;
  const footW = 2 * params.altitude * Math.tan(hfov / 2); // across-track footprint (m)
  const footH = footW * (drone?.aspect ?? 0.75); // along-track footprint (m)
  const spacing = Math.max(5, footW * (1 - params.sidelap / 100));
  const trigger = Math.max(2, footH * (1 - params.frontlap / 100));
  const b = bbox(poly);
  const wps = [];
  let dir = 1;
  for (let y = b.y + spacing / 2; y < b.y2; y += spacing) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, c) => a - c);
    if (xs.length < 2) continue;
    const a = xs[0], c = xs[xs.length - 1];
    if (dir > 0) wps.push([a, y], [c, y]); else wps.push([c, y], [a, y]);
    dir *= -1;
  }
  let length = 0;
  for (let i = 1; i < wps.length; i++) length += Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
  const turns = Math.max(0, wps.length / 2 - 1);
  const timeS = length / params.speed + turns * 6 + 90; // + climb/transit/landing
  const photos = Math.ceil(length / trigger);
  const gsd = (footW * 100) / (drone?.imgW ?? 5344);
  const areaHa = polyArea(poly) / 10000;
  const endurance = (drone?.flightMin ?? 25) * 60 * 0.8; // keep 20% reserve
  return { wps, length, timeS, photos, gsd, areaHa, spacing, footW, batteries: Math.max(1, Math.ceil(timeS / endurance)), endurance };
}

export function pathPointAt(wps, dist) {
  let acc = 0;
  for (let i = 1; i < wps.length; i++) {
    const seg = Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
    if (acc + seg >= dist) {
      const t = (dist - acc) / seg;
      const x = wps[i - 1][0] + (wps[i][0] - wps[i - 1][0]) * t;
      const y = wps[i - 1][1] + (wps[i][1] - wps[i - 1][1]) * t;
      const heading = Math.atan2(wps[i][1] - wps[i - 1][1], wps[i][0] - wps[i - 1][0]);
      return { x, y, heading, seg: i };
    }
    acc += seg;
  }
  const last = wps[wps.length - 1];
  return { x: last[0], y: last[1], heading: 0, seg: wps.length - 1, done: true };
}

export function buildingsIn(poly) {
  return city().buildings.filter((b) => pointInPoly(b.x + b.w / 2, b.y + b.h / 2, poly));
}
