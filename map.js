// Offline vector map: no tiles, no network. Pan / pinch / wheel zoom.
import { city, WORLD, SEVERITY } from './geo.js';
import { iconPath } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

export function createMap(container) {
  const svg = s('svg', { class: 'map-svg', role: 'application', 'aria-label': 'Survey map' });
  const world = s('g', { class: 'world' });
  const base = s('g', { class: 'base' });
  const layers = {};
  ['damage', 'plan', 'path', 'markers', 'drone', 'edit'].forEach((n) => { layers[n] = s('g', { class: `lyr-${n}` }); });
  world.append(base, layers.damage, layers.plan, layers.path, layers.markers, layers.drone, layers.edit);
  svg.append(world);
  container.append(svg);

  const view = { x: 0, y: 0, k: 1 };
  const handlers = { click: [], vertex: null };

  drawBase(base);

  function apply() {
    world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
    svg.style.setProperty('--inv', String(1 / view.k));
    svg.style.setProperty('--k', String(view.k));
  }
  function fit(b = { x: 0, y: 0, x2: WORLD.w, y2: WORLD.h }, pad = 40) {
    const r = svg.getBoundingClientRect();
    const leftPad = document.body.classList.contains('drawer-collapsed') ? 0 : Math.min(r.width * 0.42, 514);
    const w = r.width - leftPad - pad * 2, hgt = r.height - pad * 2;
    const k = Math.min(w / (b.x2 - b.x), hgt / (b.y2 - b.y));
    view.k = Math.max(0.25, Math.min(6, k));
    view.x = leftPad + pad + (w - (b.x2 - b.x) * view.k) / 2 - b.x * view.k;
    view.y = pad + (hgt - (b.y2 - b.y) * view.k) / 2 - b.y * view.k;
    apply();
  }
  function zoomAt(f, sx, sy) {
    const nk = Math.max(0.25, Math.min(8, view.k * f));
    view.x = sx - ((sx - view.x) * nk) / view.k;
    view.y = sy - ((sy - view.y) * nk) / view.k;
    view.k = nk; apply();
  }
  const toWorld = (sx, sy) => [(sx - view.x) / view.k, (sy - view.y) / view.k];

  // ---- gestures ----
  const pts = new Map();
  let start = null, moved = false, pinch = null, dragVertex = null;
  svg.addEventListener('pointerdown', (e) => {
    const r = svg.getBoundingClientRect();
    const v = e.target.closest?.('[data-vertex]');
    if (v && handlers.vertex) { dragVertex = +v.dataset.vertex; svg.setPointerCapture(e.pointerId); return; }
    svg.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
    if (pts.size === 1) { start = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k }; moved = true; }
  });
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    if (dragVertex != null) { handlers.vertex(dragVertex, toWorld(e.clientX - r.left, e.clientY - r.top)); return; }
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((pinch.k * d) / pinch.d / view.k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    } else if (start) {
      const dx = e.clientX - start.sx, dy = e.clientY - start.sy;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { view.x = start.vx + dx; view.y = start.vy + dy; apply(); }
    }
  });
  const end = (e) => {
    const r = svg.getBoundingClientRect();
    if (dragVertex != null) { dragVertex = null; handlers.vertexEnd?.(); return; }
    if (pts.size === 1 && !moved && start) {
      const target = e.target.closest?.('[data-id]');
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      handlers.click.forEach((fn) => fn({ x: wx, y: wy, target: target?.dataset.id, kind: target?.dataset.kind }));
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) start = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); start = null; pinch = null; dragVertex = null; });
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

  // ---- layer renderers ----
  function renderDamage(findings, buildingById) {
    layers.damage.replaceChildren();
    findings.forEach((f) => {
      const b = buildingById(f.buildingId);
      const sev = f.severityFinal || f.severity;
      if (sev === 'none') return;
      layers.damage.append(s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: SEVERITY[sev].color, 'fill-opacity': 0.55, stroke: SEVERITY[sev].color, 'stroke-width': 0.8 }));
    });
  }
  function renderPlan(poly, wps, opts = {}) {
    layers.plan.replaceChildren(); layers.path.replaceChildren(); layers.edit.replaceChildren();
    if (!poly || poly.length === 0) return;
    if (poly.length >= 3) layers.plan.append(s('polygon', { points: poly.map((p) => p.join(',')).join(' '), class: 'plan-poly' }));
    else layers.plan.append(s('polyline', { points: poly.map((p) => p.join(',')).join(' '), class: 'plan-poly open' }));
    if (wps && wps.length > 1) {
      layers.path.append(s('polyline', { points: wps.map((p) => p.join(',')).join(' '), class: 'plan-path' }));
      const flown = opts.flown || [];
      if (flown.length > 1) layers.path.append(s('polyline', { points: flown.map((p) => p.join(',')).join(' '), class: 'flown-path' }));
      const hp = wps[0];
      const g = s('g', { class: 'm-home', style: `transform: translate(${hp[0]}px,${hp[1]}px) scale(var(--inv))` });
      g.append(s('circle', { r: 11 }), Object.assign(s('text', { y: 4 }), { textContent: 'H' }));
      layers.path.append(g);
    }
    if (opts.editable) {
      poly.forEach((p, i) => {
        const g = s('g', { class: 'vertex', 'data-vertex': i, style: `transform: translate(${p[0]}px,${p[1]}px) scale(var(--inv))` });
        g.append(s('circle', { r: 16, class: 'hit' }), s('circle', { r: 7 }));
        layers.edit.append(g);
      });
    }
  }
  function renderMarkers(items) {
    layers.markers.replaceChildren();
    items.forEach((m) => {
      const g = s('g', { class: `marker mk-${m.kind} ${m.selected ? 'sel' : ''}`, 'data-id': m.id, 'data-kind': m.kind, style: `transform: translate(${m.x}px,${m.y}px) scale(var(--inv))` });
      if (m.kind === 'annotation') {
        g.append(s('circle', { r: 18, class: 'hit' }));
        const p = s('path', { d: iconPath('place'), transform: 'translate(-12,-22)' });
        g.append(p);
      } else {
        g.append(s('circle', { r: 16, class: 'hit' }), s('circle', { r: m.selected ? 9 : 6.5, fill: m.color, class: 'dotm' }));
        if (m.verified) g.append(s('circle', { r: m.selected ? 12 : 9.5, class: 'ver' }));
      }
      layers.markers.append(g);
    });
  }
  function renderDrone(p, footW) {
    layers.drone.replaceChildren();
    if (!p) return;
    if (footW) {
      const fp = s('rect', { x: -footW / 2, y: -footW * 0.375, width: footW, height: footW * 0.75, class: 'footprint', transform: `translate(${p.x},${p.y}) rotate(${(p.heading * 180) / Math.PI})` });
      layers.drone.append(fp);
    }
    const g = s('g', { class: 'm-drone', style: `transform: translate(${p.x}px,${p.y}px) scale(var(--inv))` });
    g.append(s('circle', { r: 30, class: 'ring' }), s('circle', { r: 22, class: 'body' }));
    const glyph = s('g', { transform: 'translate(-12,-12)' });
    glyph.innerHTML = '<g fill="none" stroke="#fff" stroke-width="1.8"><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><path d="M8 8l2.2 2.2M16 8l-2.2 2.2M8 16l2.2-2.2M16 16l-2.2-2.2"/></g><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="#fff"/>';
    g.append(glyph);
    const arrow = s('path', { d: 'M0,-40 L7,-30 L-7,-30 Z', class: 'heading', transform: `rotate(${(p.heading * 180) / Math.PI + 90})` });
    g.append(arrow);
    layers.drone.append(g);
  }
  function showBuildings(v) { base.querySelector('.bldgs').style.display = v ? '' : 'none'; }

  new ResizeObserver(() => apply()).observe(container);
  apply();
  return {
    svg, view, fit, zoomAt, toWorld, renderPlan, renderMarkers, renderDrone, renderDamage, showBuildings,
    onClick: (fn) => handlers.click.push(fn),
    onVertex: (fn, endFn) => { handlers.vertex = fn; handlers.vertexEnd = endFn; },
    zoomIn: () => { const r = svg.getBoundingClientRect(); zoomAt(1.4, r.width * 0.6, r.height / 2); },
    zoomOut: () => { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.4, r.width * 0.6, r.height / 2); },
    centerOn: (x, y) => { const r = svg.getBoundingClientRect(); const left = document.body.classList.contains('drawer-collapsed') ? 0 : Math.min(r.width * 0.42, 514); view.x = left + (r.width - left) / 2 - x * view.k; view.y = r.height / 2 - y * view.k; apply(); },
  };
}

function drawBase(g) {
  const c = city();
  g.append(s('rect', { x: -2000, y: -2000, width: WORLD.w + 4000, height: WORLD.h + 4000, class: 'bg' }));
  const blocks = s('g', { class: 'blocks' });
  c.blocks.forEach((b) => blocks.append(s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, class: `blk ${b.kind}` })));
  const roads = s('g', { class: 'roads' });
  c.roads.forEach((r) => roads.append(s('line', { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, 'stroke-width': r.w, class: r.rail ? 'rail' : 'road' })));
  const bl = s('g', { class: 'bldgs' });
  c.buildings.forEach((b) => bl.append(s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, class: 'bldg' })));
  const labels = s('g', { class: 'labels' });
  c.roads.forEach((r) => {
    if (!r.name) return;
    const vertical = r.x1 === r.x2;
    const positions = vertical ? [125, 575, 1025, 1475] : [135, 735, 1335, 1935];
    positions.forEach((p) => {
      const t = s('text', { style: `transform: translate(${vertical ? r.x1 : p}px,${vertical ? p : r.y1}px) scale(var(--inv))${vertical ? ' rotate(90deg)' : ''}`, dy: 4 });
      t.textContent = r.name;
      labels.append(t);
    });
  });
  g.append(blocks, roads, bl, labels);
}
