(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/geo.js
  var WORLD = { w: 2370, h: 1600 };
  var ORIGIN = { lat: 25.801, lon: -80.201 };
  var M_PER_DEG_LAT = 111320;
  var M_PER_DEG_LON = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
  function toLatLon(x, y) {
    return { lat: ORIGIN.lat - y / M_PER_DEG_LAT, lon: ORIGIN.lon + x / M_PER_DEG_LON };
  }
  function fmtDMS(x, y, alt) {
    const { lat, lon } = toLatLon(x, y);
    const dms = (v, pos, neg) => {
      const s2 = v >= 0 ? pos : neg;
      v = Math.abs(v);
      const d = Math.floor(v);
      const mF = (v - d) * 60;
      const m = Math.floor(mF);
      const sec = ((mF - m) * 60).toFixed(2);
      return `${d}\xB0${m}\u2032${sec}\u2033${s2}`;
    };
    return `${dms(lat, "N", "S")} ${dms(lon, "E", "W")}${alt != null ? ` ${alt.toFixed(1)}m` : ""}`;
  }
  function fmtLatLon(x, y) {
    const { lat, lon } = toLatLon(x, y);
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var AVENUES = ["NW 7th Ave", "NW 6th Ave", "NW 5th Ave", "NW 4th Ave", "NW 3rd Ave", "NW 2nd Ave", "NW 1st Ave", "N Miami Ave", "NE 1st Ave", "NE 2nd Ave", "NE 3rd Ave", "NE 4th Ave", "NE 5th Ave", "NE 6th Ave", "NE 7th Ave", "NE 8th Ave"];
  var STREETS = ["NW 23rd St", "NW 22nd St", "NW 21st St", "NW 20th St", "NW 19th St", "NW 18th St", "NW 17th St", "NW 16th St", "NW 15th St", "NW 14th St", "NW 13th St"];
  var SEVERITY = {
    destroyed: { label: "Destroyed", color: "#E5484D", factor: 1, rank: 4 },
    major: { label: "Major", color: "#FF9800", factor: 0.5, rank: 3 },
    minor: { label: "Minor", color: "#F5D90A", factor: 0.15, rank: 2 },
    affected: { label: "Affected", color: "#65A3FF", factor: 0.05, rank: 1 },
    none: { label: "No visible damage", color: "#9E9E9E", factor: 0, rank: 0 }
  };
  var SEVERITY_ORDER = ["destroyed", "major", "minor", "affected", "none"];
  var _city = null;
  function city() {
    if (_city) return _city;
    const r = rng(20261028);
    const avX = AVENUES.map((_, i) => 60 + i * 150);
    const stY = STREETS.map((_, j) => 50 + j * 150);
    const roads = [];
    avX.forEach((x, i) => roads.push({ name: AVENUES[i], x1: x, y1: 0, x2: x, y2: WORLD.h, w: i === 7 ? 16 : 10 }));
    stY.forEach((y, j) => roads.push({ name: STREETS[j], x1: 0, y1: y, x2: WORLD.w, y2: y, w: j === 3 || j === 6 ? 16 : 10 }));
    roads.push({ name: "", x1: 1420, y1: 0, x2: 1120, y2: WORLD.h, w: 6, rail: true });
    const blocks = [];
    const buildings = [];
    let n = 1;
    for (let i = 0; i < avX.length - 1; i++) {
      for (let j = 0; j < stY.length - 1; j++) {
        const x = avX[i] + 9, y = stY[j] + 9;
        const w = avX[i + 1] - avX[i] - 18, h2 = stY[j + 1] - stY[j] - 18;
        const roll = r();
        const kind = roll < 0.08 ? "park" : roll < 0.24 ? "commercial" : "residential";
        blocks.push({ x, y, w, h: h2, kind });
        if (kind === "park") continue;
        if (kind === "commercial") {
          const cnt = 1 + Math.floor(r() * 3);
          const bw = (w - 10) / cnt;
          for (let k = 0; k < cnt; k++) {
            const bh = h2 * (0.45 + r() * 0.35);
            buildings.push(mkBuilding(n++, x + 5 + k * bw + 3, y + (h2 - bh) / 2, bw - 6, bh, "commercial", avX[i], stY[j], r));
          }
          continue;
        }
        const lots = Math.floor(w / 26);
        const lotW = w / lots;
        for (let row = 0; row < 2; row++) {
          for (let k = 0; k < lots; k++) {
            if (r() < 0.1) continue;
            const bw = lotW * (0.5 + r() * 0.2);
            const bh = h2 / 2 * (0.42 + r() * 0.2);
            const bx = x + k * lotW + (lotW - bw) / 2;
            const by = row === 0 ? y + 8 + r() * 4 : y + h2 - bh - 8 - r() * 4;
            buildings.push(mkBuilding(n++, bx, by, bw, bh, "residential", avX[i], stY[j], r));
          }
        }
      }
    }
    buildings.forEach((b) => {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const d = Math.abs(0.55 * cx + cy - 1500) / Math.hypot(0.55, 1);
      const intensity = Math.max(0, 1 - d / 460) * 0.8 + r() * 0.32;
      b.severity = intensity > 0.94 ? "destroyed" : intensity > 0.8 ? "major" : intensity > 0.6 ? "minor" : intensity > 0.42 ? "affected" : "none";
      b.roofHue = Math.floor(r() * 4);
      b.seed = Math.floor(r() * 1e9);
    });
    _city = { roads, blocks, buildings, avX, stY };
    return _city;
  }
  function mkBuilding(n, x, y, w, h2, type, avx, sty, r) {
    const value = type === "commercial" ? Math.round((650 + r() * 1400) / 5) * 5e3 : Math.round((210 + r() * 160) / 5) * 5e3;
    const ci = AVENUES.length;
    const num = 1400 + Math.round((WORLD.h - sty) / 150 * 100) + Math.floor(r() * 90);
    const ave = AVENUES[Math.min(ci - 1, Math.max(0, Math.round((avx - 60) / 150)))];
    return { id: `S-${String(n).padStart(4, "0")}`, x, y, w, h: h2, type, value, address: `${num} ${ave}`, stories: type === "commercial" ? 1 + Math.floor(r() * 3) : 1 };
  }
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a / 2);
  }
  function bbox(points) {
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  function surveyPlan(poly, params, drone) {
    if (!poly || poly.length < 3) return null;
    const hfov = (drone?.hfov ?? 69) * Math.PI / 180;
    const footW = 2 * params.altitude * Math.tan(hfov / 2);
    const footH = footW * (drone?.aspect ?? 0.75);
    const spacing = Math.max(5, footW * (1 - params.sidelap / 100));
    const trigger = Math.max(2, footH * (1 - params.frontlap / 100));
    const b = bbox(poly);
    const wps = [];
    let dir = 1;
    for (let y = b.y + spacing / 2; y < b.y2; y += spacing) {
      const xs = [];
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        if (y1 <= y && y2 > y || y2 <= y && y1 > y) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
      }
      xs.sort((a2, c2) => a2 - c2);
      if (xs.length < 2) continue;
      const a = xs[0], c = xs[xs.length - 1];
      if (dir > 0) wps.push([a, y], [c, y]);
      else wps.push([c, y], [a, y]);
      dir *= -1;
    }
    let length = 0;
    for (let i = 1; i < wps.length; i++) length += Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
    const turns = Math.max(0, wps.length / 2 - 1);
    const timeS = length / params.speed + turns * 6 + 90;
    const photos = Math.ceil(length / trigger);
    const gsd = footW * 100 / (drone?.imgW ?? 5344);
    const areaHa = polyArea(poly) / 1e4;
    const endurance = (drone?.flightMin ?? 25) * 60 * 0.8;
    return { wps, length, timeS, photos, gsd, areaHa, spacing, footW, batteries: Math.max(1, Math.ceil(timeS / endurance)), endurance };
  }
  function pathPointAt(wps, dist) {
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
    const last2 = wps[wps.length - 1];
    return { x: last2[0], y: last2[1], heading: 0, seg: wps.length - 1, done: true };
  }
  function buildingsIn(poly) {
    return city().buildings.filter((b) => pointInPoly(b.x + b.w / 2, b.y + b.h / 2, poly));
  }

  // js/store.js
  var KEY = "uav-survey-v1";
  var listeners = /* @__PURE__ */ new Set();
  var DEFAULT_SETTINGS = {
    simSpeed: 10,
    network: "auto",
    // auto | offline | online  (override for demos)
    factors: { destroyed: 1, major: 0.5, minor: 0.15, affected: 0.05, none: 0 },
    pilot: { name: "J. Rivera", cert: "FAA Part 107 #4471902", org: "County Emergency Management \u2014 UAS Team" },
    incident: { name: "Hurricane Delta", declaration: "Pending", county: "Miami-Dade County, FL" }
  };
  var DRONES = [
    { id: "d1", name: "Parrot Anafi", kind: "quad", serial: "PI040416AA8C112", sensor: "EO 21MP", flightMin: 25, weight: "320g", hfov: 69, aspect: 0.75, imgW: 5344, battery: 98, signal: "strong", available: true, firmware: "1.8.2", sats: 14, storageGB: 54 },
    { id: "d2", name: "SenseFly eBee X", kind: "wing", serial: "EBX-0X99A2310", sensor: "EO S.O.D.A 20MP", flightMin: 55, weight: "1.4kg", hfov: 64, aspect: 0.67, imgW: 5472, battery: 20, signal: "weak", available: true, firmware: "4.2.0", sats: 11, storageGB: 61 },
    { id: "d3", name: "Survey Quad (spare)", kind: "quad2", serial: "SQ2-0000000318", sensor: "EO 12MP", flightMin: 30, weight: "895g", hfov: 72, aspect: 0.75, imgW: 4e3, battery: 0, signal: "none", available: false, firmware: "\u2014", sats: 0, storageGB: 0 }
  ];
  function fresh() {
    return { settings: structuredClone(DEFAULT_SETTINGS), drones: structuredClone(DRONES), connectedId: null, link: null, flights: [], findings: [], annotations: [], reports: [], seq: 1 };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s2 = JSON.parse(raw);
        s2.settings = { ...structuredClone(DEFAULT_SETTINGS), ...s2.settings };
        return s2;
      }
    } catch (e) {
    }
    return fresh();
  }
  var state = load();
  var ui = { panel: "drones", selectedFlight: null, selectedFinding: null, annotateMode: false, drawMode: false, draft: null, filters: { severity: /* @__PURE__ */ new Set(), q: "" }, layers: { buildings: true, plan: true, findings: true, annotations: true } };
  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
      }
    }, 150);
  }
  function emit(what) {
    save();
    listeners.forEach((fn) => fn(what));
  }
  function on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function nextId(prefix) {
    const n = state.seq++;
    return `${prefix}${String(n).padStart(6, "0")}`;
  }
  function reset() {
    const f = fresh();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, f);
    emit("reset");
  }
  var droneById = (id) => state.drones.find((d) => d.id === id);
  var flightById = (id) => state.flights.find((f) => f.id === id);
  var connectedDrone = () => droneById(state.connectedId);
  var buildingById = (id) => city().buildings.find((b) => b.id === id);
  function planFor(flight) {
    return surveyPlan(flight.poly, flight.params, droneById(flight.droneId));
  }
  function findingCost(f) {
    const b = buildingById(f.buildingId);
    if (f.costOverride != null && f.costOverride !== "") return Number(f.costOverride);
    const sev = f.severityFinal || f.severity;
    return Math.round((b?.value ?? 0) * (state.settings.factors[sev] ?? SEVERITY[sev].factor));
  }
  function totalsFor(flightIds) {
    const fs = state.findings.filter((f) => flightIds.includes(f.flightId));
    const out = {};
    Object.keys(SEVERITY).forEach((k) => out[k] = { count: 0, cost: 0, residential: 0, commercial: 0 });
    fs.forEach((f) => {
      const sev = f.severityFinal || f.severity;
      const b = buildingById(f.buildingId);
      out[sev].count++;
      out[sev].cost += findingCost(f);
      out[sev][b?.type || "residential"]++;
    });
    const all = Object.values(out);
    return {
      bySev: out,
      structures: fs.length,
      damaged: fs.filter((f) => (f.severityFinal || f.severity) !== "none").length,
      verified: fs.filter((f) => f.verified).length,
      cost: all.reduce((a, b) => a + b.cost, 0)
    };
  }
  function loadSample() {
    const poly = [[700, 520], [1560, 480], [1640, 1040], [760, 1100]];
    const f = {
      id: nextId("F"),
      name: "Overtown Block Survey",
      desc: "Post-landfall residential damage survey, sector 4",
      location: "Miami, FL",
      tags: ["Hurricane Delta 2026", "Sector 4", "PDA"],
      droneId: "d1",
      status: "completed",
      poly,
      params: { altitude: 60, speed: 9, frontlap: 75, sidelap: 70 },
      planName: "SECTOR4-GRID-60M",
      created: Date.now() - 36e5,
      start: Date.now() - 34e5,
      end: Date.now() - 21e5,
      progress: 1e9,
      photos: 0
    };
    const plan = planFor(f);
    f.photos = plan.photos;
    state.flights.unshift(f);
    buildingsIn(poly).forEach((b, i) => {
      state.findings.push(mkFinding(f, b, f.start + i * 2400));
    });
    state.annotations.push({ id: nextId("A"), flightId: f.id, x: 1110, y: 805, text: "Downed power lines blocking NW 18th St. Road impassable to vehicles \u2014 flag for utility crew.", tags: ["Hazard", "Utilities"], ts: f.start + 9e5 });
    state.annotations.push({ id: nextId("A"), flightId: f.id, x: 860, y: 955, text: "Standing water ~0.5 m across intersection. Possible storm drain blockage.", tags: ["Flooding"], ts: f.start + 11e5 });
    emit("sample");
    return f;
  }
  function mkFinding(flight, b, ts) {
    const conf = 0.71 + b.seed % 1e3 / 1e3 * 0.27;
    return { id: nextId("D"), flightId: flight.id, buildingId: b.id, severity: b.severity, severityFinal: null, verified: false, confidence: +conf.toFixed(2), notes: "", costOverride: null, ts, photoN: 1 + b.seed % 900 };
  }

  // js/ui.js
  function h(tag, attrs = {}, ...kids) {
    const el2 = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el2.className = v;
      else if (k === "style" && typeof v === "object") Object.entries(v).forEach(([sk, sv]) => sk.startsWith("--") ? el2.style.setProperty(sk, sv) : el2.style[sk] = sv);
      else if (k.startsWith("on")) el2.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "html") el2.innerHTML = v;
      else el2.setAttribute(k, v === true ? "" : v);
    }
    kids.flat(Infinity).forEach((c) => c != null && c !== false && el2.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return el2;
  }
  var P = {
    list: "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z",
    layers: "M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z",
    checklist: "M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z",
    addLocation: "M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm4 8h-3v3h-2v-3H8V8h3V5h2v3h3v2z",
    place: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    chart: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
    account: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z",
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    collapse: "M12.41 16.59L8.83 13H23v-2H8.83l3.58-3.59L11 6l-6 6 6 6 1.41-1.41zM4 18V6H2v12h2z",
    expandLess: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
    expandMore: "M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z",
    search: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    cloudOff: "M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z",
    cloudDone: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    check: "M9 16.17L4.83 12l-1.42 1.42L9 19 21 7l-1.41-1.41z",
    edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    send: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    share: "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z",
    usb: "M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93 0-1.21-.99-2.2-2.2-2.2-1.21 0-2.2.99-2.2 2.2 0 .85.5 1.56 1.2 1.93V13c0 1.11.89 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95 0 1.22.99 2.2 2.2 2.2 1.21 0 2.2-.98 2.2-2.2 0-.85-.49-1.58-1.2-1.95V15h3c1.11 0 2-.89 2-2v-2h1V7h-4z",
    wifi: "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
    bluetooth: "M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z",
    area: "M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z",
    undo: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
    video: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
    takeoff: "M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z",
    land: "M2.5 19h19v2h-19v-2zm7.18-5.73l4.35 1.16 5.31 1.42c.8.21 1.62-.26 1.84-1.06.21-.8-.26-1.62-1.06-1.84l-5.31-1.42-2.76-9.02L10.12 2v8.28L5.15 8.95l-.93-2.32-1.45-.39v5.17l1.6.43 5.31 1.43z",
    image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
    warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    refresh: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    print: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z",
    arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
    sd: "M18 2h-8L4.02 8 4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 6h-2V4h2v4zm3 0h-2V4h2v4zm3 0h-2V4h2v4z"
  };
  var DRONE_SVG = '<svg viewBox="0 0 24 24" class="ic"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><path d="M8 8l2.2 2.2M16 8l-2.2 2.2M8 16l2.2-2.2M16 16l-2.2-2.2"/></g><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor"/></svg>';
  function icon(name, cls = "") {
    const span = document.createElement("span");
    span.className = `icw ${cls}`;
    span.innerHTML = name === "drone" ? DRONE_SVG : `<svg viewBox="0 0 24 24" class="ic"><path d="${P[name]}" fill="currentColor"/></svg>`;
    return span;
  }
  var iconPath = (name) => P[name];
  function btn(label, opts = {}) {
    const { variant = "primary", icon: ic, onClick, disabled, small, title, cls = "" } = opts;
    return h("button", { class: `btn btn-${variant} ${small ? "btn-sm" : ""} ${cls}`, onclick: onClick, disabled, title, type: "button" }, ic ? icon(ic) : null, label ? h("span", {}, label) : null);
  }
  function chip(label, opts = {}) {
    const { onDelete, variant = "basic", onClick, color, active } = opts;
    const el2 = h(
      "span",
      { class: `chip chip-${variant} ${active ? "active" : ""} ${onClick ? "clickable" : ""}`, onclick: onClick, style: color ? { "--chip-dot": color } : null },
      color ? h("i", { class: "dot" }) : null,
      h("span", { class: "chip-label" }, label),
      onDelete ? h("button", { class: "chip-x", type: "button", "aria-label": `Remove ${label}`, onclick: (e) => {
        e.stopPropagation();
        onDelete();
      } }, icon("close")) : null
    );
    return el2;
  }
  function batteryChip(pct, connected = true) {
    const lvl = !connected || pct <= 0 ? "off" : pct <= 20 ? "warn" : "ok";
    const fill = Math.max(0, Math.min(100, pct));
    return h(
      "span",
      { class: `chip chip-status s-${lvl}` },
      h("span", {}, connected ? `${pct}%` : "0%"),
      h("span", { class: "batt", html: `<i style="height:${connected ? fill : 0}%"></i>` })
    );
  }
  function signalChip(sig) {
    const map2 = { strong: ["Strong", "ok", 4], weak: ["Weak", "warn", 2], none: ["Signal", "off", 0] };
    const [label, lvl, bars] = map2[sig] || map2.none;
    const b = [1, 2, 3, 4].map((i) => `<i class="${i <= bars ? "on" : ""}" style="height:${i * 25}%"></i>`).join("");
    return h("span", { class: `chip chip-status s-${lvl}` }, h("span", {}, label), h("span", { class: "bars", html: b }));
  }
  function statusChip(status) {
    const map2 = { live: ["Live", "ok", "video"], playback: ["Playback", "info", "play"], off: ["Disconnected", "off", "video"] };
    const [label, lvl, ic] = map2[status] || map2.off;
    return h("span", { class: `chip chip-status s-${lvl}` }, h("span", {}, label), icon(ic, "chip-ic"));
  }
  var toastT;
  function toast(msg, kind = "") {
    const el2 = document.getElementById("toast");
    el2.className = `toast show ${kind}`;
    el2.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => el2.className = "toast", 3200);
  }
  function modal({ title, body, footer, wide, onClose, cls = "" }) {
    const root = document.getElementById("modal-root");
    const close = () => {
      wrap.remove();
      onClose?.();
    };
    const wrap = h(
      "div",
      { class: "backdrop", onclick: (e) => e.target === wrap && close() },
      h(
        "div",
        { class: `dialog ${wide ? "wide" : ""} ${cls}`, role: "dialog", "aria-modal": "true", "aria-label": title },
        h("div", { class: "dialog-head" }, h("h2", {}, title), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, icon("close"))),
        h("div", { class: "dialog-body" }, body),
        footer ? h("div", { class: "dialog-foot" }, footer) : null
      )
    );
    root.append(wrap);
    return { close, el: wrap };
  }
  function confirmDialog(title, text, okLabel = "Confirm") {
    return new Promise((res) => {
      const m = modal({
        title,
        body: h("p", { class: "muted" }, text),
        onClose: () => res(false),
        footer: [btn("Cancel", { variant: "dark", onClick: () => {
          m.close();
        } }), btn(okLabel, { onClick: () => {
          res(true);
          m.el.remove();
        } })]
      });
    });
  }
  var money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  var fmtTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  var fmtDur = (s2) => {
    s2 = Math.round(s2);
    const m = Math.floor(s2 / 60);
    return m ? `${m}m ${String(s2 % 60).padStart(2, "0")}s` : `${s2}s`;
  };
  function field(label, input, hint) {
    return h("label", { class: "field" }, h("span", { class: "field-label" }, label), input, hint ? h("span", { class: "field-hint" }, hint) : null);
  }
  function drawerHeader(title, extra) {
    return h(
      "div",
      { class: "drawer-head" },
      h("h1", {}, title),
      extra || null,
      h("button", { class: "icon-btn", "aria-label": "Collapse panel", onclick: () => document.body.classList.toggle("drawer-collapsed") }, icon("collapse"))
    );
  }
  function emptyState(text, action) {
    return h("div", { class: "empty" }, h("p", {}, text), action || null);
  }

  // js/map.js
  var NS = "http://www.w3.org/2000/svg";
  var s = (tag, attrs = {}) => {
    const el2 = document.createElementNS(NS, tag);
    for (const k in attrs) el2.setAttribute(k, attrs[k]);
    return el2;
  };
  function createMap(container) {
    const svg = s("svg", { class: "map-svg", role: "application", "aria-label": "Survey map" });
    const world = s("g", { class: "world" });
    const base = s("g", { class: "base" });
    const layers = {};
    ["damage", "plan", "path", "markers", "drone", "edit"].forEach((n) => {
      layers[n] = s("g", { class: `lyr-${n}` });
    });
    world.append(base, layers.damage, layers.plan, layers.path, layers.markers, layers.drone, layers.edit);
    svg.append(world);
    container.append(svg);
    const view = { x: 0, y: 0, k: 1 };
    const handlers = { click: [], vertex: null };
    drawBase(base);
    function apply() {
      world.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
      svg.style.setProperty("--inv", String(1 / view.k));
      svg.style.setProperty("--k", String(view.k));
    }
    function fit(b = { x: 0, y: 0, x2: WORLD.w, y2: WORLD.h }, pad = 40) {
      const r = svg.getBoundingClientRect();
      const leftPad = document.body.classList.contains("drawer-collapsed") ? 0 : Math.min(r.width * 0.42, 514);
      const w = r.width - leftPad - pad * 2, hgt = r.height - pad * 2;
      const k = Math.min(w / (b.x2 - b.x), hgt / (b.y2 - b.y));
      view.k = Math.max(0.25, Math.min(6, k));
      view.x = leftPad + pad + (w - (b.x2 - b.x) * view.k) / 2 - b.x * view.k;
      view.y = pad + (hgt - (b.y2 - b.y) * view.k) / 2 - b.y * view.k;
      apply();
    }
    function zoomAt(f, sx, sy) {
      const nk = Math.max(0.25, Math.min(8, view.k * f));
      view.x = sx - (sx - view.x) * nk / view.k;
      view.y = sy - (sy - view.y) * nk / view.k;
      view.k = nk;
      apply();
    }
    const toWorld = (sx, sy) => [(sx - view.x) / view.k, (sy - view.y) / view.k];
    const pts = /* @__PURE__ */ new Map();
    let start2 = null, moved = false, pinch = null, dragVertex = null;
    svg.addEventListener("pointerdown", (e) => {
      const r = svg.getBoundingClientRect();
      const v = e.target.closest?.("[data-vertex]");
      if (v && handlers.vertex) {
        dragVertex = +v.dataset.vertex;
        svg.setPointerCapture(e.pointerId);
        return;
      }
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
      if (pts.size === 1) {
        start2 = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        moved = false;
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k };
        moved = true;
      }
    });
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      if (dragVertex != null) {
        handlers.vertex(dragVertex, toWorld(e.clientX - r.left, e.clientY - r.top));
        return;
      }
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt(pinch.k * d / pinch.d / view.k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      } else if (start2) {
        const dx = e.clientX - start2.sx, dy = e.clientY - start2.sy;
        if (Math.hypot(dx, dy) > 6) moved = true;
        if (moved) {
          view.x = start2.vx + dx;
          view.y = start2.vy + dy;
          apply();
        }
      }
    });
    const end = (e) => {
      const r = svg.getBoundingClientRect();
      if (dragVertex != null) {
        dragVertex = null;
        handlers.vertexEnd?.();
        return;
      }
      if (pts.size === 1 && !moved && start2) {
        const target = e.target.closest?.("[data-id]");
        const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
        handlers.click.forEach((fn) => fn({ x: wx, y: wy, target: target?.dataset.id, kind: target?.dataset.kind }));
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) start2 = null;
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", (e) => {
      pts.delete(e.pointerId);
      start2 = null;
      pinch = null;
      dragVertex = null;
    });
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 15e-4), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    function renderDamage(findings, buildingById2) {
      layers.damage.replaceChildren();
      findings.forEach((f) => {
        const b = buildingById2(f.buildingId);
        const sev = f.severityFinal || f.severity;
        if (sev === "none") return;
        layers.damage.append(s("rect", { x: b.x, y: b.y, width: b.w, height: b.h, fill: SEVERITY[sev].color, "fill-opacity": 0.55, stroke: SEVERITY[sev].color, "stroke-width": 0.8 }));
      });
    }
    function renderPlan(poly, wps, opts = {}) {
      layers.plan.replaceChildren();
      layers.path.replaceChildren();
      layers.edit.replaceChildren();
      if (!poly || poly.length === 0) return;
      if (poly.length >= 3) layers.plan.append(s("polygon", { points: poly.map((p) => p.join(",")).join(" "), class: "plan-poly" }));
      else layers.plan.append(s("polyline", { points: poly.map((p) => p.join(",")).join(" "), class: "plan-poly open" }));
      if (wps && wps.length > 1) {
        layers.path.append(s("polyline", { points: wps.map((p) => p.join(",")).join(" "), class: "plan-path" }));
        const flown = opts.flown || [];
        if (flown.length > 1) layers.path.append(s("polyline", { points: flown.map((p) => p.join(",")).join(" "), class: "flown-path" }));
        const hp = wps[0];
        const g = s("g", { class: "m-home", style: `transform: translate(${hp[0]}px,${hp[1]}px) scale(var(--inv))` });
        g.append(s("circle", { r: 11 }), Object.assign(s("text", { y: 4 }), { textContent: "H" }));
        layers.path.append(g);
      }
      if (opts.editable) {
        poly.forEach((p, i) => {
          const g = s("g", { class: "vertex", "data-vertex": i, style: `transform: translate(${p[0]}px,${p[1]}px) scale(var(--inv))` });
          g.append(s("circle", { r: 16, class: "hit" }), s("circle", { r: 7 }));
          layers.edit.append(g);
        });
      }
    }
    function renderMarkers(items) {
      layers.markers.replaceChildren();
      items.forEach((m) => {
        const g = s("g", { class: `marker mk-${m.kind} ${m.selected ? "sel" : ""}`, "data-id": m.id, "data-kind": m.kind, style: `transform: translate(${m.x}px,${m.y}px) scale(var(--inv))` });
        if (m.kind === "annotation") {
          g.append(s("circle", { r: 18, class: "hit" }));
          const p = s("path", { d: iconPath("place"), transform: "translate(-12,-22)" });
          g.append(p);
        } else {
          g.append(s("circle", { r: 16, class: "hit" }), s("circle", { r: m.selected ? 9 : 6.5, fill: m.color, class: "dotm" }));
          if (m.verified) g.append(s("circle", { r: m.selected ? 12 : 9.5, class: "ver" }));
        }
        layers.markers.append(g);
      });
    }
    function renderDrone(p, footW) {
      layers.drone.replaceChildren();
      if (!p) return;
      if (footW) {
        const fp = s("rect", { x: -footW / 2, y: -footW * 0.375, width: footW, height: footW * 0.75, class: "footprint", transform: `translate(${p.x},${p.y}) rotate(${p.heading * 180 / Math.PI})` });
        layers.drone.append(fp);
      }
      const g = s("g", { class: "m-drone", style: `transform: translate(${p.x}px,${p.y}px) scale(var(--inv))` });
      g.append(s("circle", { r: 30, class: "ring" }), s("circle", { r: 22, class: "body" }));
      const glyph = s("g", { transform: "translate(-12,-12)" });
      glyph.innerHTML = '<g fill="none" stroke="#fff" stroke-width="1.8"><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><path d="M8 8l2.2 2.2M16 8l-2.2 2.2M8 16l2.2-2.2M16 16l-2.2-2.2"/></g><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="#fff"/>';
      g.append(glyph);
      const arrow = s("path", { d: "M0,-40 L7,-30 L-7,-30 Z", class: "heading", transform: `rotate(${p.heading * 180 / Math.PI + 90})` });
      g.append(arrow);
      layers.drone.append(g);
    }
    function showBuildings(v) {
      base.querySelector(".bldgs").style.display = v ? "" : "none";
    }
    new ResizeObserver(() => apply()).observe(container);
    apply();
    return {
      svg,
      view,
      fit,
      zoomAt,
      toWorld,
      renderPlan,
      renderMarkers,
      renderDrone,
      renderDamage,
      showBuildings,
      onClick: (fn) => handlers.click.push(fn),
      onVertex: (fn, endFn) => {
        handlers.vertex = fn;
        handlers.vertexEnd = endFn;
      },
      zoomIn: () => {
        const r = svg.getBoundingClientRect();
        zoomAt(1.4, r.width * 0.6, r.height / 2);
      },
      zoomOut: () => {
        const r = svg.getBoundingClientRect();
        zoomAt(1 / 1.4, r.width * 0.6, r.height / 2);
      },
      centerOn: (x, y) => {
        const r = svg.getBoundingClientRect();
        const left = document.body.classList.contains("drawer-collapsed") ? 0 : Math.min(r.width * 0.42, 514);
        view.x = left + (r.width - left) / 2 - x * view.k;
        view.y = r.height / 2 - y * view.k;
        apply();
      }
    };
  }
  function drawBase(g) {
    const c = city();
    g.append(s("rect", { x: -2e3, y: -2e3, width: WORLD.w + 4e3, height: WORLD.h + 4e3, class: "bg" }));
    const blocks = s("g", { class: "blocks" });
    c.blocks.forEach((b) => blocks.append(s("rect", { x: b.x, y: b.y, width: b.w, height: b.h, class: `blk ${b.kind}` })));
    const roads = s("g", { class: "roads" });
    c.roads.forEach((r) => roads.append(s("line", { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, "stroke-width": r.w, class: r.rail ? "rail" : "road" })));
    const bl = s("g", { class: "bldgs" });
    c.buildings.forEach((b) => bl.append(s("rect", { x: b.x, y: b.y, width: b.w, height: b.h, class: "bldg" })));
    const labels = s("g", { class: "labels" });
    c.roads.forEach((r) => {
      if (!r.name) return;
      const vertical = r.x1 === r.x2;
      const positions = vertical ? [125, 575, 1025, 1475] : [135, 735, 1335, 1935];
      positions.forEach((p) => {
        const t = s("text", { style: `transform: translate(${vertical ? r.x1 : p}px,${vertical ? p : r.y1}px) scale(var(--inv))${vertical ? " rotate(90deg)" : ""}`, dy: 4 });
        t.textContent = r.name;
        labels.append(t);
      });
    });
    g.append(blocks, roads, bl, labels);
  }

  // js/sim.js
  var subs = /* @__PURE__ */ new Set();
  var live = { flightId: null, running: false, pos: null, plan: null, battery: 100, signal: "strong", alt: 0, speed: 0, photos: 0, lastSave: 0, seen: /* @__PURE__ */ new Set(), alert: null };
  function onTick(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }
  var tickAll = () => subs.forEach((fn) => fn(live));
  function scan() {
    return new Promise((res) => setTimeout(() => res(state.drones), 1400));
  }
  async function connect(droneId, method2) {
    const d = droneById(droneId);
    if (!d.available) throw new Error(`${d.name} is not responding. Check that it is powered on and in range.`);
    await new Promise((r) => setTimeout(r, 1600));
    state.connectedId = droneId;
    state.link = { method: method2, since: Date.now() };
    emit("link");
    return d;
  }
  function disconnect() {
    if (live.running) stop();
    state.connectedId = null;
    state.link = null;
    emit("link");
  }
  var raf = null;
  var last = 0;
  function start(flightId) {
    const f = flightById(flightId);
    const d = droneById(f.droneId);
    live.flightId = flightId;
    live.plan = planFor(f);
    live.battery = d.battery;
    live.seen = new Set(state.findings.filter((x) => x.flightId === flightId).map((x) => x.buildingId));
    live.candidates = buildingsIn(f.poly).map((b) => ({ b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }));
    live.alert = null;
    if (f.status !== "in-progress") {
      f.status = "in-progress";
      f.start = f.start || Date.now();
      f.progress = f.progress || 0;
    }
    live.running = true;
    emit("flight");
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    live.running = false;
    cancelAnimationFrame(raf);
    emit("flight");
    tickAll();
  }
  function resume() {
    if (!live.flightId) return;
    live.alert = null;
    live.running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
    emit("flight");
  }
  function swapBattery() {
    live.battery = 100;
    const d = droneById(flightById(live.flightId).droneId);
    d.battery = 100;
    resume();
  }
  function stop() {
    live.running = false;
    cancelAnimationFrame(raf);
    const f = flightById(live.flightId);
    if (f && f.status === "in-progress") f.status = "paused";
    live.flightId = null;
    live.pos = null;
    emit("flight");
    tickAll();
  }
  function loop(now) {
    const dtReal = Math.min(0.1, (now - last) / 1e3);
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
    live.battery = Math.max(0, live.battery - dt / (d.flightMin * 60) * 100);
    d.battery = Math.round(live.battery);
    const distHome = Math.hypot(p.x - live.plan.wps[0][0], p.y - live.plan.wps[0][1]);
    live.signal = distHome > 700 ? "weak" : "strong";
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
      f.status = "completed";
      f.end = Date.now();
      live.alert = { kind: "done", text: "Mission complete. Drone returned home and landed." };
      emit("flight");
      tickAll();
      return;
    }
    if (live.battery <= 22) {
      live.running = false;
      live.alert = { kind: "battery", text: `Battery at ${Math.round(live.battery)}%. Drone is returning home \u2014 swap the battery to resume the mission where it left off.` };
      emit("flight");
      tickAll();
      return;
    }
    if (now - live.lastSave > 1e3 || live.newFinding) {
      live.lastSave = now;
      live.newFinding = false;
      emit("tick");
    }
    tickAll();
    raf = requestAnimationFrame(loop);
  }

  // js/feed.js
  var ROOFS = ["#9a5b45", "#6d6f73", "#c9c4b8", "#a08664"];
  var COMM_ROOFS = ["#8c8f94", "#b5b8bb", "#77797c", "#a3a6a1"];
  function drawGround(ctx, x0, y0, x1, y1) {
    const c = city();
    ctx.fillStyle = "#56653d";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.blocks.forEach((b, i) => {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) return;
      ctx.fillStyle = b.kind === "park" ? "#4d6b35" : b.kind === "commercial" ? "#7d7a72" : "#5f6e42";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const r = rng(i * 7919 + 13);
      const n = b.kind === "park" ? 40 : 14;
      for (let k = 0; k < n; k++) {
        const tx = b.x + r() * b.w, ty = b.y + r() * b.h, tr = 2.5 + r() * 3.5;
        ctx.fillStyle = r() < 0.25 ? "#6e5a3a" : "#3b5326";
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    c.roads.forEach((rd) => {
      ctx.strokeStyle = rd.rail ? "#5a5047" : "#3e3f41";
      ctx.lineWidth = rd.w;
      ctx.beginPath();
      ctx.moveTo(rd.x1, rd.y1);
      ctx.lineTo(rd.x2, rd.y2);
      ctx.stroke();
      if (!rd.rail && rd.w > 12) {
        ctx.strokeStyle = "#b9a560";
        ctx.lineWidth = 0.4;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(rd.x1, rd.y1);
        ctx.lineTo(rd.x2, rd.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
  function drawBuilding(ctx, b) {
    const r = rng(b.seed);
    const roofs = b.type === "commercial" ? COMM_ROOFS : ROOFS;
    const roof = roofs[b.roofHue];
    const sev = b.severity;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(b.x + 1.5, b.y + 1.5, b.w, b.h);
    if (sev !== "destroyed") {
      ctx.fillStyle = roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      if (b.w > b.h) {
        ctx.moveTo(b.x, b.y + b.h / 2);
        ctx.lineTo(b.x + b.w, b.y + b.h / 2);
      } else {
        ctx.moveTo(b.x + b.w / 2, b.y);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h);
      }
      ctx.stroke();
    }
    const debris = (count, spread, palette) => {
      for (let k = 0; k < count; k++) {
        const dx = b.x - spread + r() * (b.w + spread * 2), dy = b.y - spread + r() * (b.h + spread * 2);
        ctx.fillStyle = palette[Math.floor(r() * palette.length)];
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(r() * Math.PI);
        ctx.fillRect(-0.4, -0.4, 0.6 + r() * 2.6, 0.4 + r() * 1.2);
        ctx.restore();
      }
    };
    const DEB = ["#d9d2c3", "#8a6b4b", "#b7b2a8", "#5b4a3a", roof];
    if (sev === "affected") debris(10, 6, DEB);
    if (sev === "minor") {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = "#2d2a26";
        ctx.fillRect(b.x + r() * b.w * 0.8, b.y + r() * b.h * 0.8, b.w * 0.15, b.h * 0.12);
      }
      debris(26, 8, DEB);
    }
    if (sev === "major") {
      if (r() < 0.6) {
        ctx.fillStyle = "#2f6fb3";
        ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.1, b.w * 0.55, b.h * 0.5);
      }
      ctx.fillStyle = "#231f1b";
      ctx.fillRect(b.x + b.w * (0.4 + r() * 0.3), b.y + b.h * 0.45, b.w * 0.3, b.h * 0.35);
      debris(60, 12, DEB);
    }
    if (sev === "destroyed") {
      ctx.fillStyle = "#6f6455";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      debris(160, 4, ["#d9d2c3", "#8a6b4b", "#b7b2a8", "#5b4a3a", "#3a332b", "#e8e2d4"]);
      debris(70, 18, DEB);
      ctx.strokeStyle = "#4a3a26";
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 2; k++) {
        const tx = b.x + r() * b.w, ty = b.y + b.h + 3 + r() * 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + 8 - r() * 16, ty + 4);
        ctx.stroke();
      }
    }
  }
  function renderAerial(ctx, cx, cy, scale, w, h2, opts = {}) {
    ctx.save();
    ctx.fillStyle = "#56653d";
    ctx.fillRect(0, 0, w, h2);
    ctx.translate(w / 2, h2 / 2);
    if (opts.heading != null) ctx.rotate(-opts.heading - Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    const R = Math.hypot(w, h2) / scale / 2 + 20;
    drawGround(ctx, cx - R, cy - R, cx + R, cy + R);
    city().buildings.forEach((b) => {
      if (Math.abs(b.x - cx) < R && Math.abs(b.y - cy) < R) drawBuilding(ctx, b);
    });
    ctx.restore();
    if (opts.grain) {
      const g = ctx.createRadialGradient(w / 2, h2 / 2, h2 * 0.3, w / 2, h2 / 2, h2 * 0.8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h2);
    }
  }
  var thumbCache = /* @__PURE__ */ new Map();
  function thumb(b, w = 240, hgt = 170) {
    const key = `${b.id}-${w}`;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const cv = document.createElement("canvas");
    const dpr = 2;
    cv.width = w * dpr;
    cv.height = hgt * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const scale = Math.min(w / (b.w * 2.4), hgt / (b.h * 2.4));
    renderAerial(ctx, b.x + b.w / 2, b.y + b.h / 2, scale, w, hgt, { grain: true });
    ctx.strokeStyle = "#3F8CFF";
    ctx.lineWidth = 1.5;
    const bw = b.w * scale + 10, bh = b.h * scale + 10;
    ctx.strokeRect(w / 2 - bw / 2, hgt / 2 - bh / 2, bw, bh);
    const url = cv.toDataURL("image/jpeg", 0.82);
    thumbCache.set(key, url);
    return url;
  }

  // js/views/flight-hud.js
  var hud = document.getElementById("hud");
  var pip = document.getElementById("pip");
  var canvas = pip.querySelector("canvas");
  var pipMeta = pip.querySelector(".pip-meta");
  var lastKey = "";
  pip.addEventListener("click", () => pip.classList.toggle("big"));
  function renderHud(app2) {
    const f = flightById(live.flightId);
    pip.hidden = !f;
    if (!f) {
      hud.hidden = true;
      hud.replaceChildren();
      lastKey = "";
      return;
    }
    hud.hidden = false;
    const d = droneById(f.droneId);
    const total = live.plan.length;
    const pct = Math.min(100, f.progress / total * 100);
    const found = state.findings.filter((x) => x.flightId === f.id);
    const dmg = found.filter((x) => x.severity !== "none").length;
    const key = `${live.running}-${live.alert?.kind}-${ui.annotateMode}-${state.settings.simSpeed}`;
    const stats = [
      ["ALT", `${live.alt.toFixed(1)} m`],
      ["SPD", `${live.speed.toFixed(1)} m/s`],
      ["PHOTOS", `${f.photos}`],
      ["STRUCTURES", `${found.length}`],
      ["DAMAGED", `${dmg}`],
      ["ETA", fmtDur(Math.max(0, (total - f.progress) / f.params.speed))]
    ];
    if (key !== lastKey) {
      lastKey = key;
      hud.replaceChildren(...[
        h(
          "div",
          { class: "hud-top" },
          h("div", { class: "hud-title" }, h("span", { class: `live-dot ${live.running ? "" : "paused"}` }), h("b", {}, f.name), h("span", { class: "muted" }, live.running ? " \xB7 Autonomous mission" : " \xB7 Holding")),
          h("div", { class: "hud-chips" }, h("span", { class: "hud-batt" }), h("span", { class: "hud-sig" }))
        ),
        h("div", { class: "hud-stats" }, stats.map(([k]) => h("div", { class: "stat" }, h("span", { class: "k" }, k), h("span", { class: "v", "data-k": k })))),
        h("div", { class: "hud-progress" }, h("i")),
        live.alert ? h("div", { class: `hud-alert ${live.alert.kind}` }, icon(live.alert.kind === "done" ? "check" : "warning"), h("span", {}, live.alert.text)) : null,
        h(
          "div",
          { class: "hud-actions" },
          live.alert?.kind === "done" ? [btn("Review damage", { icon: "arrow", onClick: () => {
            stop();
            ui.annotateMode = false;
            app2.go("review");
          } })] : live.alert?.kind === "battery" ? [btn("Battery swapped \u2014 resume", { icon: "refresh", onClick: () => swapBattery() }), btn("End mission", { variant: "dark", icon: "land", onClick: () => {
            stop();
          } })] : [
            live.running ? btn("Hold", { variant: "dark", icon: "pause", onClick: pause }) : btn("Resume", { icon: "play", onClick: resume }),
            btn("Return home", { variant: "dark", icon: "home", onClick: () => {
              stop();
            } }),
            btn(ui.annotateMode ? "Annotating" : "Annotate", { variant: ui.annotateMode ? "primary" : "dark", icon: "addLocation", onClick: () => {
              ui.annotateMode = !ui.annotateMode;
              app2.rerender();
            } }),
            h(
              "label",
              { class: "sim-speed", title: "Simulation speed (prototype only)" },
              "Sim \xD7",
              h("select", { onchange: (e) => {
                state.settings.simSpeed = +e.target.value;
                emit("settings");
              } }, [1, 5, 10, 25, 50].map((v) => h("option", { value: v, selected: v === state.settings.simSpeed }, v)))
            )
          ]
        )
      ].filter(Boolean));
    }
    stats.forEach(([k, v]) => {
      const el2 = hud.querySelector(`[data-k="${k}"]`);
      if (el2) el2.textContent = v;
    });
    hud.querySelector(".hud-progress i").style.width = `${pct}%`;
    hud.querySelector(".hud-batt").replaceChildren(batteryChip(Math.round(live.battery)));
    hud.querySelector(".hud-sig").replaceChildren(signalChip(live.signal));
    pipMeta.textContent = `LIVE \xB7 EO \xB7 ${fmtTime(Date.now()).slice(11)} \xB7 ${live.alt.toFixed(0)}m AGL`;
  }
  function renderFeed() {
    if (!live.pos || pip.hidden) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(r.width * dpr)) {
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = r.width / (live.plan.footW * 1.05);
    renderAerial(ctx, live.pos.x, live.pos.y, scale, r.width, r.height, { heading: live.pos.heading, grain: true });
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 1;
    const cx = r.width / 2, cy = r.height / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  // js/views/drones.js
  var drones_exports = {};
  __export(drones_exports, {
    droneImage: () => droneImage,
    droneSpecs: () => droneSpecs,
    render: () => render
  });
  var METHODS = [
    { id: "usb", icon: "usb", label: "Controller", sub: "USB-C cable" },
    { id: "wifi", icon: "wifi", label: "Drone Wi-Fi", sub: "Aircraft hotspot" },
    { id: "ble", icon: "bluetooth", label: "Bluetooth", sub: "Low energy" }
  ];
  var method = "usb";
  var scanning = false;
  var scanned = false;
  var busy = null;
  var open = null;
  function droneImage(d, size = "md") {
    const art = {
      quad: '<svg viewBox="0 0 120 100"><g fill="#2b2b2b"><ellipse cx="60" cy="52" rx="16" ry="10"/><rect x="20" y="47" width="80" height="4" rx="2"/><rect x="40" y="38" width="40" height="4" rx="2" transform="rotate(25 60 40)"/><rect x="40" y="58" width="40" height="4" rx="2" transform="rotate(-25 60 60)"/></g><g fill="#555"><ellipse cx="20" cy="45" rx="14" ry="2"/><ellipse cx="100" cy="45" rx="14" ry="2"/><ellipse cx="32" cy="66" rx="14" ry="2"/><ellipse cx="88" cy="66" rx="14" ry="2"/></g><circle cx="60" cy="61" r="4" fill="#111"/></svg>',
      wing: '<svg viewBox="0 0 120 100"><path d="M60 14 L112 78 L80 72 L60 86 L40 72 L8 78 Z" fill="#1d1d1d"/><path d="M60 14 L66 50 L60 60 L54 50 Z" fill="#c9a227"/><path d="M60 14 L78 46 M60 14 L42 46" stroke="#c9a227" stroke-width="1.5"/></svg>',
      quad2: '<svg viewBox="0 0 120 100"><g fill="#cfcfcf" stroke="#9a9a9a"><rect x="44" y="40" width="32" height="20" rx="6"/><path d="M10 50 H110" stroke-width="3"/></g><g fill="#888"><ellipse cx="14" cy="44" rx="12" ry="2"/><ellipse cx="106" cy="44" rx="12" ry="2"/></g><circle cx="60" cy="64" r="5" fill="#333"/></svg>'
    }[d.kind] || "";
    return h("div", { class: `drone-img ${size}`, html: art });
  }
  function droneSpecs(d) {
    return h(
      "div",
      { class: "specs" },
      h("div", { class: "spec-name" }, d.name),
      h("div", {}, `Serial Number: ${d.serial}`),
      h("div", {}, `Primary sensor: ${d.sensor}`),
      h("div", {}, `Flight time: ~${d.flightMin} min`),
      h("div", {}, `Weight: ${d.weight}`)
    );
  }
  function render(app2) {
    const connected = state.connectedId;
    const doScan = async () => {
      scanning = true;
      app2.rerender();
      await scan();
      scanning = false;
      scanned = true;
      app2.rerender();
    };
    if (!scanned && !scanning) setTimeout(doScan, 50);
    const list = state.drones.map((d) => {
      const isConn = connected === d.id;
      const expanded = open === d.id || isConn;
      return h(
        "div",
        { class: `drone-row ${isConn ? "connected" : ""} ${!d.available ? "unavailable" : ""} ${expanded ? "open" : ""}`, onclick: () => {
          open = open === d.id ? null : d.id;
          app2.rerender();
        } },
        h(
          "div",
          { class: "drone-main" },
          droneImage(d),
          droneSpecs(d),
          h(
            "div",
            { class: "chip-col" },
            isConn ? statusChip("live") : !d.available ? statusChip("off") : null,
            batteryChip(d.battery, d.available),
            signalChip(d.available ? d.signal : "none")
          )
        ),
        expanded ? h(
          "div",
          { class: "drone-detail", onclick: (e) => e.stopPropagation() },
          isConn ? [
            h(
              "div",
              { class: "kv-grid" },
              kv("Link", METHODS.find((m) => m.id === state.link?.method)?.label + " \xB7 encrypted"),
              kv("Linked since", fmtTime(state.link?.since).slice(11)),
              kv("Firmware", d.firmware),
              kv("GPS", `${d.sats} satellites \xB7 3D fix`),
              kv("Storage", `${d.storageGB} GB free`),
              kv("Home point", "Set at launch site")
            ),
            h(
              "div",
              { class: "row-actions" },
              btn("Disconnect", { variant: "dark", small: true, onClick: () => {
                disconnect();
                toast(`${d.name} disconnected`);
              } }),
              btn("Plan a flight", { small: true, icon: "arrow", onClick: () => app2.go("flights") })
            )
          ] : d.available ? h(
            "div",
            { class: "row-actions" },
            h("span", { class: "muted small" }, d.battery <= 20 ? "Low battery \u2014 swap before a long mission." : "Ready to link."),
            btn(busy === d.id ? "Connecting\u2026" : "Connect", { small: true, disabled: !!busy, onClick: async () => {
              busy = d.id;
              app2.rerender();
              try {
                if (connected) disconnect();
                await connect(d.id, method);
                toast(`Linked to ${d.name} via ${METHODS.find((m) => m.id === method).label}`, "ok");
              } catch (err) {
                toast(err.message, "err");
              }
              busy = null;
              open = null;
              app2.rerender();
            } })
          ) : h("div", { class: "row-actions" }, h("span", { class: "muted small" }, "Not responding. Power it on, or move closer, then scan again."))
        ) : null
      );
    });
    return h(
      "div",
      { class: "drawer-inner" },
      drawerHeader("Drone Details"),
      h(
        "div",
        { class: "drawer-body" },
        h(
          "div",
          { class: "section pad" },
          h("div", { class: "eyebrow" }, "Connection method"),
          h("div", { class: "seg" }, METHODS.map((m) => h("button", { class: `seg-btn ${method === m.id ? "active" : ""}`, onclick: () => {
            method = m.id;
            app2.rerender();
          } }, icon(m.icon), h("span", {}, h("b", {}, m.label), h("small", {}, m.sub))))),
          h("p", { class: "muted small" }, "Direct link to the aircraft \u2014 no internet, cell service or cloud account needed.")
        ),
        h(
          "div",
          { class: "list-head" },
          h("span", {}, scanning ? "Searching for aircraft\u2026" : `${state.drones.filter((d) => d.available).length} aircraft found`),
          btn(scanning ? "" : "Scan", { variant: "dark", small: true, icon: "refresh", cls: scanning ? "spin" : "", disabled: scanning, onClick: doScan })
        ),
        scanning && !scanned ? h("div", { class: "scan-anim" }, h("i"), h("i"), h("i")) : list
      ),
      connected ? h("div", { class: "drawer-foot" }, btn("Next: plan flight", { icon: "arrow", onClick: () => app2.go("flights") })) : null
    );
  }
  function kv(k, v) {
    return h("div", { class: "kv" }, h("span", { class: "k" }, k), h("span", { class: "v" }, v));
  }

  // js/views/flights.js
  var flights_exports = {};
  __export(flights_exports, {
    openWizard: () => openWizard,
    render: () => render2,
    renderDrawBar: () => renderDrawBar
  });
  var STATUS_LABEL = { planned: "Planned", "in-progress": "In-Progress", paused: "Paused", completed: "Completed" };
  function render2(app2) {
    const rows = state.flights.map((f) => flightRow(app2, f));
    return h(
      "div",
      { class: "drawer-inner" },
      drawerHeader("Flight Log"),
      h(
        "div",
        { class: "drawer-body" },
        state.flights.length ? h("div", { class: "table-head" }, h("span", {}, "LOCATION"), h("span", {}, "DESCRIPTION"), h("span", {}, "STATUS")) : null,
        rows.length ? rows : emptyState("No flights yet. Create a survey mission to begin.", h(
          "div",
          { class: "stack center" },
          btn("New flight", { icon: "add", onClick: () => openWizard(app2) }),
          btn("Load sample completed survey", { variant: "text", onClick: () => {
            const f = loadSample();
            ui.selectedFlight = f.id;
            toast("Sample survey loaded");
            app2.rerender();
          } })
        ))
      ),
      h("div", { class: "drawer-foot" }, btn("New flight", { icon: "add", onClick: () => openWizard(app2) }))
    );
  }
  function flightRow(app2, f) {
    const open2 = ui.selectedFlight === f.id;
    const d = droneById(f.droneId);
    const isLive = live.flightId === f.id;
    const plan = planFor(f);
    let loc = "-";
    if (isLive && live.pos) loc = `Live: ${fmtDMS(live.pos.x, live.pos.y, live.alt)}`;
    else if (f.status !== "planned" && plan) loc = `Take Off: ${fmtDMS(plan.wps[0][0], plan.wps[0][1], 0)}`;
    const actions = [];
    if (f.status === "planned" || f.status === "paused") {
      if (f.status === "planned") {
        actions.push(btn("Delete", { variant: "dark", small: true, onClick: async () => {
          if (await confirmDialog("Delete flight?", "The flight plan will be removed from this device.", "Delete")) {
            state.flights = state.flights.filter((x) => x.id !== f.id);
            emit("flights");
          }
        } }));
        actions.push(btn("Edit", { variant: "dark", small: true, onClick: () => openWizard(app2, f) }));
      }
      actions.push(btn(f.status === "paused" ? "Resume flight" : "Start flight", { small: true, icon: "takeoff", onClick: () => launch(app2, f) }));
    } else if (isLive) {
      actions.push(btn(ui.annotateMode ? "Annotating" : "Annotate", { small: true, variant: ui.annotateMode ? "primary" : "dark", onClick: () => {
        ui.annotateMode = !ui.annotateMode;
        app2.rerender();
      } }));
    } else if (f.status === "completed") {
      actions.push(btn("Review damage", { small: true, icon: "arrow", onClick: () => app2.go("review") }));
    }
    return h(
      "div",
      { class: `frow ${open2 ? "open" : ""}` },
      h(
        "button",
        { class: "frow-head", onclick: () => {
          ui.selectedFlight = open2 ? null : f.id;
          app2.rerender();
          if (!open2) app2.map && setTimeout(() => document.getElementById("btn-fit").click(), 0);
        } },
        icon(open2 ? "expandLess" : "expandMore", "exp"),
        h("span", { class: "loc link" }, f.location),
        h("span", { class: "desc" }, f.desc || f.name),
        h("span", { class: `st st-${f.status}` }, STATUS_LABEL[f.status])
      ),
      open2 ? h(
        "div",
        { class: "frow-body" },
        kvRow("ID", f.id),
        kvRow("MISSION TAGS", h("div", { class: "chips" }, f.tags.map((t) => chip(t)))),
        kvRow("TIME", h("div", {}, h("div", {}, `Start: ${f.start ? fmtTime(f.start) : "-"}`), h("div", {}, `End: ${f.end ? fmtTime(f.end) : "-"}`))),
        kvRow("DRONE", h("div", { class: "drone-cell" }, droneSpecs(d), h("div", { class: "chip-col" }, statusChip(isLive ? "live" : f.status === "completed" ? "playback" : state.connectedId === d.id ? "live" : "off"), batteryChip(d.battery, d.available), signalChip(isLive ? live.signal : d.available ? d.signal : "none"))), "tall"),
        kvRow("FLIGHT PLAN", h("div", {}, h("div", {}, f.planName), plan ? h("div", { class: "muted small" }, `${plan.areaHa.toFixed(1)} ha \xB7 ${f.params.altitude} m AGL \xB7 ${plan.photos} photos \xB7 ~${fmtDur(plan.timeS)} \xB7 GSD ${plan.gsd.toFixed(1)} cm/px`) : null)),
        kvRow("LOCATION", loc),
        h("div", { class: "row-actions right" }, actions)
      ) : null
    );
  }
  function kvRow(k, v, cls = "") {
    return h("div", { class: `kvrow ${cls}` }, h("span", { class: "k" }, k), h("div", { class: "v" }, v));
  }
  function launch(app2, f) {
    const d = connectedDrone();
    if (!d || d.id !== f.droneId) {
      toast(`Connect ${droneById(f.droneId).name} before starting this flight.`, "err");
      app2.go("drones");
      return;
    }
    if (live.flightId && live.flightId !== f.id) stop();
    ui.selectedFlight = f.id;
    start(f.id);
    toast("Mission uploaded \u2014 takeoff. Autonomous survey in progress.", "ok");
    app2.rerender();
    setTimeout(() => document.getElementById("btn-fit").click(), 0);
  }
  var wiz = null;
  function openWizard(app2, existing) {
    const conn = connectedDrone();
    ui.draft = existing ? structuredClone(existing) : {
      id: null,
      name: `Survey ${state.flights.length + 1}`,
      desc: "",
      location: "Miami, FL",
      tags: [`${state.settings.incident.name} ${(/* @__PURE__ */ new Date()).getFullYear()}`],
      droneId: conn?.id || null,
      poly: [],
      params: { altitude: 60, speed: 9, frontlap: 75, sidelap: 70 },
      checks: {}
    };
    ui.draft.checks = ui.draft.checks || {};
    wiz = { step: existing ? 1 : 0, app: app2, existing: !!existing };
    showWizard();
  }
  function showWizard() {
    const { app: app2 } = wiz;
    const d = ui.draft;
    const plan = d.poly.length >= 3 && d.droneId ? surveyPlan(d.poly, d.params, droneById(d.droneId)) : null;
    const steps = [stepDrone, stepMission, stepChecklist];
    const canNext = [() => !!d.droneId, () => d.poly.length >= 3 && d.name.trim(), () => true][wiz.step]();
    const allChecked = CHECKS.every((c) => d.checks[c.id]);
    const footer = [
      h("div", { class: "dots" }, [0, 1, 2].map((i) => h("i", { class: i === wiz.step ? "on" : "" }))),
      h("span", { class: "grow" }),
      wiz.step > 0 ? btn("Back", { variant: "dark", onClick: () => {
        wiz.step--;
        rerenderWizard();
      } }) : null,
      wiz.step < 2 ? btn("Next", { disabled: !canNext, onClick: () => {
        wiz.step++;
        rerenderWizard();
      } }) : null,
      wiz.step === 2 ? btn("Save plan", { variant: "dark", onClick: () => saveDraft(false) }) : null,
      wiz.step === 2 ? btn("Save & start flight", { icon: "takeoff", disabled: !allChecked, title: allChecked ? "" : "Complete the pre-flight checklist", onClick: () => saveDraft(true) }) : null
    ];
    wiz.modal?.el.remove();
    wiz.modal = modal({ title: wiz.existing ? "Edit Flight" : "New Flight", body: steps[wiz.step](plan), footer, cls: "wizard", onClose: () => {
      ui.draft = null;
      ui.drawMode = false;
      wiz = null;
      app2.rerender();
    } });
    app2.refreshMap();
  }
  function rerenderWizard() {
    const sc = wiz.modal?.el.querySelector(".dialog-body")?.scrollTop;
    showWizard();
    if (sc) wiz.modal.el.querySelector(".dialog-body").scrollTop = sc;
  }
  function stepDrone() {
    const d = ui.draft;
    return h(
      "div",
      {},
      h("div", { class: "step-head" }, h("h3", {}, "Select sUAS"), btn("New", { variant: "dark", small: true, icon: "add", onClick: () => {
        const a = wiz.app;
        wiz.modal.close();
        a.go("drones");
      } })),
      h("div", { class: "pick-list" }, state.drones.map((dr) => h(
        "button",
        { class: `pick ${d.droneId === dr.id ? "sel" : ""}`, disabled: !dr.available, onclick: () => {
          d.droneId = dr.id;
          rerenderWizard();
        } },
        droneImage(dr),
        droneSpecs(dr),
        h("div", { class: "chip-col" }, state.connectedId === dr.id ? statusChip("live") : null, batteryChip(dr.battery, dr.available), signalChip(dr.available ? dr.signal : "none"))
      ))),
      d.droneId && state.connectedId !== d.droneId ? h("p", { class: "note warn" }, icon("warning"), "This aircraft is not linked. You can save the plan now and connect before takeoff.") : null
    );
  }
  function stepMission(plan) {
    const d = ui.draft;
    const dr = droneById(d.droneId);
    const tagInput = h("input", { class: "input", placeholder: "Add tag and press Enter", onkeydown: (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        e.preventDefault();
        d.tags.push(e.target.value.trim());
        rerenderWizard();
      }
    } });
    const slider = (key, label, min, max, step, unit, hint) => field(
      `${label}: ${d.params[key]} ${unit}`,
      h("input", { type: "range", min, max, step, value: d.params[key], oninput: (e) => {
        d.params[key] = +e.target.value;
        e.target.closest(".field").querySelector(".field-label").textContent = `${label}: ${d.params[key]} ${unit}`;
        updateEst();
        wiz.app.refreshMap();
      } }),
      hint
    );
    const est = h("div", { class: "est" });
    function updateEst() {
      const p = d.poly.length >= 3 ? surveyPlan(d.poly, d.params, dr) : null;
      est.replaceChildren(...p ? [
        estItem("Area", `${p.areaHa.toFixed(1)} ha`),
        estItem("Flight time", `~${fmtDur(p.timeS)}`),
        estItem("Photos", p.photos),
        estItem("GSD", `${p.gsd.toFixed(1)} cm/px`),
        estItem("Batteries", p.batteries, p.batteries > 1 ? "warn" : ""),
        estItem("Line spacing", `${p.spacing.toFixed(0)} m`)
      ] : [h("span", { class: "muted small" }, "Draw the survey area to see estimates.")]);
    }
    updateEst();
    return h(
      "div",
      { class: "stack" },
      h(
        "div",
        { class: "grid2" },
        field("Flight name", h("input", { class: "input", value: d.name, oninput: (e) => {
          d.name = e.target.value;
        } })),
        field("Location", h("input", { class: "input", value: d.location, oninput: (e) => {
          d.location = e.target.value;
        } }))
      ),
      field("Description", h("input", { class: "input", value: d.desc, placeholder: "e.g. Residential damage survey, sector 4", oninput: (e) => {
        d.desc = e.target.value;
      } })),
      field("Mission tags", h("div", { class: "tag-input" }, h("div", { class: "chips" }, d.tags.map((t, i) => chip(t, { variant: "primary", onDelete: () => {
        d.tags.splice(i, 1);
        rerenderWizard();
      } }))), tagInput)),
      h(
        "div",
        { class: "area-box" },
        h("div", {}, h("div", { class: "eyebrow" }, "Survey area"), h("div", {}, d.poly.length >= 3 ? `${d.poly.length}-point polygon` : "No area drawn yet")),
        h(
          "div",
          { class: "row-actions" },
          btn("Use sample sector", { variant: "text", small: true, onClick: () => {
            d.poly = [[720, 540], [1500, 510], [1560, 980], [780, 1040]];
            rerenderWizard();
            document.getElementById("btn-fit").click();
          } }),
          btn(d.poly.length ? "Edit on map" : "Draw on map", { small: true, icon: "area", onClick: () => startDraw() })
        )
      ),
      est,
      h(
        "div",
        { class: "grid2" },
        slider("altitude", "Altitude", 30, 120, 5, "m AGL", "Part 107 limit: 122 m (400 ft) AGL"),
        slider("speed", "Speed", 3, 15, 1, "m/s"),
        slider("frontlap", "Front overlap", 60, 90, 5, "%"),
        slider("sidelap", "Side overlap", 60, 90, 5, "%", "Use 70%+ for 3D / orthomosaic")
      )
    );
  }
  var estItem = (k, v, cls = "") => h("div", { class: `est-item ${cls}` }, h("span", { class: "k" }, k), h("b", {}, String(v)));
  var CHECKS = [
    { id: "airspace", label: "Airspace & TFRs checked", sub: "Disaster TFRs are common after storms \u2014 confirm via the EOC / radio when LAANC is unavailable offline." },
    { id: "wx", label: "Wind and weather within aircraft limits" },
    { id: "vo", label: "Visual observer briefed; line-of-sight maintained" },
    { id: "hazards", label: "Launch site clear of debris and power lines" },
    { id: "aircraft", label: "Props, frame and camera inspected; batteries charged" },
    { id: "rth", label: "Lost-link action set to Return-to-Home at safe altitude" }
  ];
  function stepChecklist(plan) {
    const d = ui.draft;
    const dr = droneById(d.droneId);
    return h(
      "div",
      { class: "stack" },
      h(
        "div",
        { class: "summary-card" },
        droneImage(dr, "sm"),
        h(
          "div",
          {},
          h("b", {}, d.name),
          h("div", { class: "muted small" }, `${dr.name} \xB7 ${d.params.altitude} m AGL \xB7 ${d.params.speed} m/s \xB7 ${d.params.frontlap}/${d.params.sidelap}% overlap`),
          plan ? h("div", { class: "muted small" }, `${plan.areaHa.toFixed(1)} ha \xB7 ~${fmtDur(plan.timeS)} \xB7 ${plan.photos} photos \xB7 ${plan.batteries} battery${plan.batteries > 1 ? " swaps" : ""}`) : null
        )
      ),
      h("div", { class: "eyebrow" }, "Pre-flight checklist"),
      h("div", { class: "checks" }, CHECKS.map((c) => h(
        "label",
        { class: `check ${d.checks[c.id] ? "on" : ""}` },
        h("input", { type: "checkbox", checked: !!d.checks[c.id], onchange: (e) => {
          d.checks[c.id] = e.target.checked;
          rerenderWizard();
        } }),
        h("span", { class: "box" }, icon("check")),
        h("span", {}, h("span", {}, c.label), c.sub ? h("small", {}, c.sub) : null)
      ))),
      h("p", { class: "muted small" }, "The plan is stored on this device and uploaded to the aircraft over the direct link \u2014 it does not need a connection.")
    );
  }
  function saveDraft(andStart) {
    const app2 = wiz.app;
    const d = ui.draft;
    let f = d.id ? flightById(d.id) : null;
    if (!f) {
      f = { ...d, id: nextId("F"), status: "planned", created: Date.now(), start: null, end: null, progress: 0, photos: 0 };
      f.planName = `${d.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${d.params.altitude}M`;
      state.flights.unshift(f);
    } else {
      Object.assign(f, d, { planName: `${d.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${d.params.altitude}M` });
    }
    delete f.checks;
    ui.selectedFlight = f.id;
    ui.draft = null;
    ui.drawMode = false;
    wiz.modal.el.remove();
    wiz = null;
    emit("flights");
    toast(andStart ? "Plan saved" : "Flight plan saved to Flight Log", "ok");
    if (andStart) launch(app2, f);
  }
  function startDraw() {
    ui.drawMode = true;
    wiz.modal.el.style.display = "none";
    renderDrawBar(wiz.app);
    wiz.app.refreshMap();
  }
  function renderDrawBar(app2) {
    const bar = document.getElementById("drawbar");
    if (!ui.drawMode || !ui.draft) {
      bar.hidden = true;
      return;
    }
    const n = ui.draft.poly.length;
    bar.hidden = false;
    bar.replaceChildren(
      icon("area"),
      h("span", {}, n < 3 ? `Tap the map to place corners of the survey area (${n} placed)` : `${n} corners \xB7 drag points to adjust`),
      btn("Undo", { variant: "dark", small: true, icon: "undo", disabled: !n, onClick: () => {
        ui.draft.poly.pop();
        app2.refreshMap();
        renderDrawBar(app2);
      } }),
      btn("Clear", { variant: "dark", small: true, disabled: !n, onClick: () => {
        ui.draft.poly = [];
        app2.refreshMap();
        renderDrawBar(app2);
      } }),
      btn("Done", { small: true, icon: "check", disabled: n > 0 && n < 3, onClick: () => {
        ui.drawMode = false;
        bar.hidden = true;
        wiz.modal.el.style.display = "";
        rerenderWizard();
      } })
    );
  }

  // js/views/review.js
  var review_exports = {};
  __export(review_exports, {
    filteredAnnotations: () => filteredAnnotations,
    filteredFindings: () => filteredFindings,
    render: () => render3,
    scrollToSelected: () => scrollToSelected
  });

  // js/views/annotate.js
  var MAX = 500;
  var el = null;
  function closeAnnotation() {
    el?.remove();
    el = null;
  }
  function openAnnotation(app2, { id, x, y }) {
    closeAnnotation();
    const existing = id ? state.annotations.find((a2) => a2.id === id) : null;
    const a = existing ? structuredClone(existing) : { x, y, text: "", tags: [], ts: Date.now() };
    let mode = existing ? "saved" : "edit";
    const flightId = existing?.flightId || live.flightId || ui.selectedFlight || state.flights[0]?.id;
    if (!flightId) return;
    const host = document.getElementById("map");
    el = h("div", { class: "annot", role: "dialog", "aria-label": "Annotation" });
    host.append(el);
    const place = () => {
      const r = host.getBoundingClientRect();
      const sx = a.x * app2.map.view.k + app2.map.view.x, sy = a.y * app2.map.view.k + app2.map.view.y;
      const w = 320, hgt = el.offsetHeight || 420;
      let left = sx + 18, top = sy - hgt / 2;
      if (left + w > r.width - 12) left = sx - w - 18;
      el.style.left = `${Math.max(12, left)}px`;
      el.style.top = `${Math.max(64, Math.min(r.height - hgt - 12, top))}px`;
    };
    const draw = () => {
      const tagIn = h("input", { class: "input", placeholder: "Mission Tags", onkeydown: (e) => {
        if (e.key === "Enter" && e.target.value.trim()) {
          e.preventDefault();
          a.tags.push(e.target.value.trim());
          draw();
          el.querySelector(".tag-in")?.focus();
        }
      } });
      tagIn.classList.add("tag-in");
      const counter = h("span", { class: "chars" });
      const ta = h("textarea", { class: "input", rows: 9, maxlength: MAX, placeholder: "What did you see? e.g. Roof collapse, person signalling, blocked road\u2026", oninput: (e) => {
        a.text = e.target.value;
        upd();
      } }, a.text);
      const upd = () => {
        const left = MAX - a.text.length;
        counter.textContent = `*${left} Characters Left`;
        counter.classList.toggle("warn", left < 50);
        save2.disabled = !a.text.trim();
      };
      const save2 = btn("Save", { small: true, onClick: () => {
        if (existing) Object.assign(existing, { text: a.text, tags: a.tags, ts: Date.now() });
        else state.annotations.push({ id: nextId("A"), flightId, x: a.x, y: a.y, text: a.text, tags: a.tags, ts: Date.now() });
        closeAnnotation();
        emit("annotation");
      } });
      if (mode === "saved") {
        el.replaceChildren(
          h("div", { class: "annot-ts" }, fmtTime(existing.ts)),
          h("p", { class: "annot-text" }, existing.text),
          h("div", { class: "chips" }, existing.tags.map((t) => chip(t))),
          h(
            "div",
            { class: "row-actions right" },
            btn("Delete", { variant: "dark", small: true, icon: "delete", onClick: () => {
              mode = "confirm";
              draw();
            } }),
            btn("Close", { variant: "dark", small: true, onClick: closeAnnotation }),
            btn("Edit", { small: true, icon: "edit", onClick: () => {
              mode = "edit";
              draw();
            } })
          )
        );
      } else if (mode === "confirm") {
        el.replaceChildren(
          h("p", {}, "Are you sure? This annotation will be deleted forever."),
          h(
            "div",
            { class: "row-actions right" },
            btn("Cancel", { variant: "dark", small: true, onClick: () => {
              mode = "saved";
              draw();
            } }),
            btn("Delete", { variant: "danger", small: true, onClick: () => {
              state.annotations = state.annotations.filter((x2) => x2.id !== existing.id);
              closeAnnotation();
              emit("annotation");
            } })
          )
        );
      } else {
        el.replaceChildren(
          h("div", { class: "annot-ts" }, fmtTime(a.ts)),
          h("label", { class: "filled" }, h("span", { class: "filled-label" }, "Annotate"), ta),
          counter,
          h("div", { class: "filled tags" }, tagIn),
          h("div", { class: "chips" }, a.tags.map((t, i) => chip(t, { onDelete: () => {
            a.tags.splice(i, 1);
            draw();
          } }))),
          h("div", { class: "row-actions right" }, btn("Cancel", { variant: "dark", small: true, onClick: () => existing ? (mode = "saved", draw()) : closeAnnotation() }), save2)
        );
        upd();
        setTimeout(() => ta.focus(), 30);
      }
      place();
    };
    draw();
  }

  // js/views/review.js
  var tab = "structures";
  var flightFilter = "all";
  var scopeIds = () => {
    const done = state.flights.filter((f) => f.status !== "planned");
    return flightFilter === "all" ? done.map((f) => f.id) : [flightFilter];
  };
  function filteredFindings(flightIds) {
    const q = ui.filters.q.trim().toLowerCase();
    const sevs = ui.filters.severity;
    return state.findings.filter((f) => {
      if (!flightIds.includes(f.flightId)) return false;
      const sev = f.severityFinal || f.severity;
      if (sevs.size && !sevs.has(sev)) return false;
      if (q) {
        const b = buildingById(f.buildingId);
        const fl = flightById(f.flightId);
        const hay = `${b.address} ${b.id} ${SEVERITY[sev].label} ${f.notes} ${fl?.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function filteredAnnotations(flightIds) {
    const q = ui.filters.q.trim().toLowerCase();
    return state.annotations.filter((a) => flightIds.includes(a.flightId) && (!q || `${a.text} ${a.tags.join(" ")}`.toLowerCase().includes(q))).sort((a, b) => b.ts - a.ts);
  }
  var io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const img = e.target;
        img.src = thumb(buildingById(img.dataset.bid));
        io.unobserve(img);
      }
    });
  }, { rootMargin: "200px" }) : null;
  function lazyThumb(b, cls = "thumb") {
    const img = h("img", { class: cls, alt: `Aerial image of ${b.address}`, "data-bid": b.id });
    if (io) io.observe(img);
    else img.src = thumb(b);
    return img;
  }
  function render3(app2) {
    const flights = state.flights.filter((f) => f.status !== "planned");
    if (!flights.length) {
      return h("div", { class: "drawer-inner" }, drawerHeader("Damage Review"), h(
        "div",
        { class: "drawer-body" },
        emptyState("No survey data yet. Fly a mission (or import from the drone\u2019s SD card) and detected damage appears here.", h(
          "div",
          { class: "stack center" },
          btn("Go to flight log", { icon: "list", onClick: () => app2.go("flights") }),
          btn("Load sample completed survey", { variant: "text", onClick: () => {
            const f = loadSample();
            ui.selectedFlight = f.id;
            app2.rerender();
          } })
        ))
      ));
    }
    if (flightFilter !== "all" && !flightById(flightFilter)) flightFilter = "all";
    const ids = scopeIds();
    const t = totalsFor(ids);
    const fs = filteredFindings(ids).sort((a, b) => SEVERITY[b.severityFinal || b.severity].rank - SEVERITY[a.severityFinal || a.severity].rank || a.buildingId.localeCompare(b.buildingId));
    const anns = filteredAnnotations(ids);
    const pct = t.structures ? Math.round(t.verified / t.structures * 100) : 0;
    return h(
      "div",
      { class: "drawer-inner" },
      drawerHeader("Damage Review"),
      h(
        "div",
        { class: "drawer-body" },
        h(
          "div",
          { class: "section pad" },
          h(
            "select",
            { class: "input", "aria-label": "Flight", onchange: (e) => {
              flightFilter = e.target.value;
              ui.selectedFlight = flightFilter === "all" ? null : flightFilter;
              ui.selectedFinding = null;
              app2.rerender();
              document.getElementById("btn-fit").click();
            } },
            h("option", { value: "all", selected: flightFilter === "all" }, `All surveyed flights (${flights.length})`),
            flights.map((f) => h("option", { value: f.id, selected: flightFilter === f.id }, `${f.name} \u2014 ${f.id}`))
          ),
          h("div", { class: "tiles" }, SEVERITY_ORDER.slice(0, 4).map((k) => h(
            "button",
            { class: `tile ${ui.filters.severity.has(k) ? "active" : ""}`, style: { "--c": SEVERITY[k].color }, onclick: () => {
              toggleSev(k);
              app2.rerender();
            } },
            h("span", { class: "tile-n" }, t.bySev[k].count),
            h("span", { class: "tile-l" }, SEVERITY[k].label)
          ))),
          h(
            "div",
            { class: "total-row" },
            h("div", {}, h("span", { class: "eyebrow" }, "Estimated loss"), h("b", { class: "big" }, money(t.cost))),
            h("div", { class: "verify" }, h("span", { class: "small muted" }, `${t.verified} of ${t.structures} verified`), h("div", { class: "bar" }, h("i", { style: { width: `${pct}%` } })))
          ),
          h("div", { class: "search" }, icon("search"), h("input", { class: "input bare", placeholder: "Search address, ID or tags", value: ui.filters.q, oninput: debounce((e) => {
            ui.filters.q = e.target.value;
            app2.rerender();
            refocus();
          }) })),
          ui.filters.severity.size || ui.filters.q ? h(
            "div",
            { class: "chips" },
            [...ui.filters.severity].map((k) => chip(SEVERITY[k].label, { variant: "primary", onDelete: () => {
              toggleSev(k);
              app2.rerender();
            } })),
            ui.filters.q ? chip(`\u201C${ui.filters.q}\u201D`, { variant: "primary", onDelete: () => {
              ui.filters.q = "";
              app2.rerender();
            } }) : null
          ) : null
        ),
        h(
          "div",
          { class: "tabs" },
          h("button", { class: tab === "structures" ? "on" : "", onclick: () => {
            tab = "structures";
            app2.rerender();
          } }, `Structures (${fs.length})`),
          h("button", { class: tab === "annotations" ? "on" : "", onclick: () => {
            tab = "annotations";
            app2.rerender();
          } }, `Annotations (${anns.length})`),
          tab === "structures" ? btn("Accept AI \u2265 90%", { variant: "text", small: true, onClick: () => bulkAccept(ids, app2) }) : null
        ),
        tab === "structures" ? fs.length ? h("div", { class: "cards" }, fs.map((f) => findingCard(app2, f))) : emptyState("No structures match these filters.") : anns.length ? h("div", { class: "cards" }, anns.map((a) => annCard(app2, a))) : emptyState("There are no annotations. Use Annotate during a flight to drop notes on the map.")
      ),
      h("div", { class: "drawer-foot" }, btn("Next: generate report", { icon: "arrow", onClick: () => app2.go("reports") }))
    );
  }
  function findingCard(app2, f) {
    const b = buildingById(f.buildingId);
    const sev = f.severityFinal || f.severity;
    const sel = ui.selectedFinding === f.id;
    const head = h(
      "div",
      { class: "fcard-head", onclick: () => {
        ui.selectedFinding = sel ? null : f.id;
        app2.rerender();
        if (!sel) app2.map.centerOn(b.x + b.w / 2, b.y + b.h / 2);
      } },
      lazyThumb(b),
      h(
        "div",
        { class: "fcard-meta" },
        h("b", {}, b.address),
        h("span", { class: "muted small" }, `${b.id} \xB7 ${b.type === "commercial" ? "Commercial" : "Residential"}`),
        h(
          "div",
          { class: "chips" },
          chip(SEVERITY[sev].label, { color: SEVERITY[sev].color }),
          f.verified ? h("span", { class: "ver-tag" }, icon("check"), "Verified") : h("span", { class: "ai-tag" }, `AI ${Math.round(f.confidence * 100)}%`)
        )
      ),
      h("div", { class: "fcard-cost" }, money(findingCost(f)))
    );
    if (!sel) return h("div", { class: "fcard" }, head);
    const notes = h("textarea", { class: "input", rows: 2, placeholder: "Field notes (visible in the report)", oninput: (e) => {
      f.notes = e.target.value;
    }, onblur: () => emit("finding") }, f.notes);
    const fileIn = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true, onchange: (e) => attachPhoto(e, f) });
    return h(
      "div",
      { class: "fcard sel", id: `card-${f.id}` },
      head,
      h(
        "div",
        { class: "fcard-body" },
        h("div", { class: "big-thumb" }, h("img", { src: f.photo || thumb(b, 460, 300), alt: "" }), h("span", { class: "img-cap" }, f.photo ? "Field photo" : `IMG_${String(f.photoN).padStart(4, "0")}.JPG \xB7 ${fmtTime(f.ts)}`)),
        h(
          "div",
          { class: "kv-grid" },
          kv2("Coordinates", fmtLatLon(b.x + b.w / 2, b.y + b.h / 2)),
          kv2("Assessed value", money(b.value)),
          kv2("AI suggestion", `${SEVERITY[f.severity].label} (${Math.round(f.confidence * 100)}%)`),
          kv2("Stories", b.stories)
        ),
        h("div", { class: "eyebrow" }, "Damage category"),
        h("div", { class: "sev-seg" }, SEVERITY_ORDER.map((k) => h("button", { class: sev === k ? "on" : "", style: { "--c": SEVERITY[k].color }, onclick: () => {
          f.severityFinal = k;
          f.verified = true;
          emit("finding");
        } }, h("i"), SEVERITY[k].label))),
        notes,
        h(
          "div",
          { class: "grid2" },
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Loss override ($)"),
            h("input", { class: "input", type: "number", inputmode: "numeric", placeholder: money(findingCost({ ...f, costOverride: null })), value: f.costOverride ?? "", onchange: (e) => {
              f.costOverride = e.target.value === "" ? null : +e.target.value;
              emit("finding");
            } })
          ),
          h("div", { class: "field" }, h("span", { class: "field-label" }, "Ground photo"), btn(f.photo ? "Replace photo" : "Attach photo", { variant: "dark", small: true, icon: "image", onClick: () => fileIn.click() }), fileIn)
        ),
        h(
          "div",
          { class: "row-actions right" },
          btn(f.verified ? "Verified" : "Confirm AI category", { variant: f.verified ? "dark" : "primary", small: true, icon: "check", onClick: () => {
            f.verified = true;
            if (!f.severityFinal) f.severityFinal = f.severity;
            emit("finding");
          } }),
          btn("Next unverified", { small: true, variant: "dark", icon: "arrow", onClick: () => nextUnverified(app2) })
        )
      )
    );
  }
  function annCard(app2, a) {
    return h(
      "div",
      { class: `acard ${ui.selectedFinding === a.id ? "sel" : ""}`, onclick: () => {
        ui.selectedFinding = a.id;
        app2.map.centerOn(a.x, a.y);
        openAnnotation(app2, { id: a.id });
      } },
      h("div", { class: "acard-ts" }, fmtTime(a.ts)),
      h("p", {}, a.text),
      h("div", { class: "chips" }, a.tags.map((t) => chip(t)))
    );
  }
  function nextUnverified(app2) {
    const list = filteredFindings(scopeIds()).filter((f) => !f.verified).sort((a, b2) => SEVERITY[b2.severity].rank - SEVERITY[a.severity].rank);
    const n = list.find((f) => f.id !== ui.selectedFinding);
    if (!n) {
      toast("All structures in view are verified", "ok");
      return;
    }
    ui.selectedFinding = n.id;
    const b = buildingById(n.buildingId);
    app2.rerender();
    app2.map.centerOn(b.x + b.w / 2, b.y + b.h / 2);
    scrollToSelected();
  }
  function bulkAccept(ids, app2) {
    let n = 0;
    state.findings.forEach((f) => {
      if (ids.includes(f.flightId) && !f.verified && f.confidence >= 0.9) {
        f.verified = true;
        f.severityFinal = f.severity;
        n++;
      }
    });
    emit("finding");
    toast(n ? `Accepted ${n} high-confidence AI assessments` : "No unverified findings at \u2265 90% confidence");
  }
  function attachPhoto(e, f) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const s2 = Math.min(1, 720 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * s2;
      c.height = img.height * s2;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      f.photo = c.toDataURL("image/jpeg", 0.78);
      URL.revokeObjectURL(img.src);
      emit("finding");
    };
    img.src = URL.createObjectURL(file);
  }
  function toggleSev(k) {
    const s2 = ui.filters.severity;
    s2.has(k) ? s2.delete(k) : s2.add(k);
  }
  function scrollToSelected() {
    requestAnimationFrame(() => document.querySelector(".fcard.sel, .acard.sel")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  function kv2(k, v) {
    return h("div", { class: "kv" }, h("span", { class: "k" }, k), h("span", { class: "v" }, String(v)));
  }
  function debounce(fn) {
    let t;
    return (e) => {
      clearTimeout(t);
      t = setTimeout(() => fn(e), 250);
    };
  }
  function refocus() {
    const el2 = document.querySelector(".search input");
    if (el2) {
      el2.focus();
      el2.setSelectionRange(el2.value.length, el2.value.length);
    }
  }

  // js/views/reports.js
  var reports_exports = {};
  __export(reports_exports, {
    REPORT_CSS: () => REPORT_CSS,
    REPORT_TYPES: () => REPORT_TYPES,
    openPreview: () => openPreview,
    processOutbox: () => processOutbox,
    render: () => render4,
    reportHTML: () => reportHTML
  });
  var REPORT_TYPES = {
    pda: { label: "FEMA Preliminary Damage Assessment (PDA) \u2014 UAS imagery summary", short: "FEMA PDA summary", recipient: "FEMA Region IV \u2014 Joint PDA Team" },
    sitrep: { label: "State EOC situation report \u2014 damage section", short: "State EOC sitrep", recipient: "Florida Division of Emergency Management \u2014 State EOC" },
    county: { label: "County initial damage assessment (IDA)", short: "County IDA", recipient: "Miami-Dade County Office of Emergency Management" }
  };
  var STATUS = { draft: ["Draft", "off"], queued: ["Queued \u2014 waiting for connection", "warn"], sending: ["Sending\u2026", "info"], delivered: ["Delivered", "ok"], failed: ["Failed \u2014 will retry", "err"] };
  var form = null;
  function render4(app2) {
    const done = state.flights.filter((f) => f.status === "completed" || state.findings.some((x) => x.flightId === f.id));
    if (!form) form = { type: "pda", flightIds: done.map((f) => f.id), recipient: REPORT_TYPES.pda.recipient, notes: "" };
    form.flightIds = form.flightIds.filter((id) => flightById(id));
    const inc = state.settings.incident;
    const t = totalsFor(form.flightIds);
    const online = app2.isOnline();
    return h(
      "div",
      { class: "drawer-inner" },
      drawerHeader("Reports"),
      h(
        "div",
        { class: "drawer-body" },
        !online ? h("div", { class: "banner warn" }, icon("cloudOff"), h("span", {}, "You\u2019re offline. Reports are saved on this device and sent automatically when a connection is available (Wi-Fi, cellular or satellite). You can also share them now with AirDrop or Quick Share, which need no internet.")) : null,
        done.length === 0 ? emptyState("Complete a survey flight to generate a damage report.", btn("Go to flight log", { icon: "list", onClick: () => app2.go("flights") })) : h(
          "div",
          { class: "section pad stack" },
          h("div", { class: "eyebrow" }, "New report"),
          field("Report type", h(
            "select",
            { class: "input", onchange: (e) => {
              form.type = e.target.value;
              form.recipient = REPORT_TYPES[form.type].recipient;
              app2.rerender();
            } },
            Object.entries(REPORT_TYPES).map(([k, v]) => h("option", { value: k, selected: form.type === k }, v.label))
          )),
          field("Send to", h("input", { class: "input", value: form.recipient, oninput: (e) => {
            form.recipient = e.target.value;
          } })),
          h(
            "div",
            { class: "grid2" },
            field("Incident", h("input", { class: "input", value: inc.name, oninput: (e) => {
              inc.name = e.target.value;
              save();
            } })),
            field("Declaration / DR #", h("input", { class: "input", value: inc.declaration, oninput: (e) => {
              inc.declaration = e.target.value;
              save();
            } }))
          ),
          field("Jurisdiction", h("input", { class: "input", value: inc.county, oninput: (e) => {
            inc.county = e.target.value;
            save();
          } })),
          h(
            "div",
            { class: "field" },
            h("span", { class: "field-label" }, "Flights included"),
            done.map((f) => h("label", { class: "check-inline" }, h("input", { type: "checkbox", checked: form.flightIds.includes(f.id), onchange: (e) => {
              form.flightIds = e.target.checked ? [...form.flightIds, f.id] : form.flightIds.filter((x) => x !== f.id);
              app2.rerender();
            } }), `${f.name} \xB7 ${f.id}`))
          ),
          field("Notes for reviewer", h("textarea", { class: "input", rows: 2, oninput: (e) => {
            form.notes = e.target.value;
          } }, form.notes)),
          h(
            "div",
            { class: "mini-sum" },
            h("span", {}, `${t.structures} structures`),
            h("span", {}, `${t.damaged} damaged`),
            h("span", {}, `${t.verified}/${t.structures} verified`),
            h("b", {}, money(t.cost))
          ),
          t.verified < t.structures ? h("p", { class: "note warn" }, icon("warning"), `${t.structures - t.verified} structures still show AI-only categories. They\u2019ll be marked \u201Cunverified\u201D in the report.`) : null,
          btn("Generate report", { icon: "chart", disabled: !form.flightIds.length, onClick: () => {
            const r = generate();
            openPreview(app2, r);
          } })
        ),
        state.reports.length ? h("div", { class: "list-head" }, h("span", {}, "Saved reports")) : null,
        h("div", { class: "cards" }, [...state.reports].reverse().map((r) => h(
          "div",
          { class: "rcard" },
          h("div", { class: "rcard-top" }, h("b", {}, REPORT_TYPES[r.type].short), h("span", { class: "muted small" }, r.id)),
          h("div", { class: "muted small" }, `${fmtTime(r.created)} \xB7 ${r.recipient}`),
          h("div", { class: "rcard-bot" }, h("span", { class: `chip chip-status s-${STATUS[r.status][1]}` }, STATUS[r.status][0]), h("b", {}, money(r.totals.cost))),
          h(
            "div",
            { class: "row-actions right" },
            btn("Open", { variant: "dark", small: true, onClick: () => openPreview(app2, r) }),
            r.status === "draft" || r.status === "failed" ? btn("Send", { small: true, icon: "send", onClick: () => send(app2, r) }) : null
          )
        )))
      )
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
      id: nextId("R"),
      created: Date.now(),
      type: form.type,
      recipient: form.recipient,
      notes: form.notes,
      incident: { ...inc },
      pilot: { ...state.settings.pilot },
      factors: { ...state.settings.factors },
      flightIds: [...form.flightIds],
      totals: totalsFor(form.flightIds),
      rows,
      status: "draft"
    };
    state.reports.push(r);
    emit("report");
    return r;
  }
  function reportHTML(r, { embedImages = true } = {}) {
    const T = REPORT_TYPES[r.type];
    const flights = r.flightIds.map(flightById).filter(Boolean);
    const area = flights.reduce((a, f) => a + (planFor(f)?.areaHa || 0), 0);
    const esc = (s2) => String(s2 ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const sumRows = SEVERITY_ORDER.map((k) => {
      const v = r.totals.bySev[k];
      return `<tr><td><span class="sw" style="background:${SEVERITY[k].color}"></span>${SEVERITY[k].label}</td><td>${v.residential}</td><td>${v.commercial}</td><td><b>${v.count}</b></td><td class="num">${money(v.cost)}</td></tr>`;
    }).join("");
    const flightRows = flights.map((f) => {
      const d = droneById(f.droneId);
      const p = planFor(f);
      return `<tr><td>${esc(f.id)}<br><small>${esc(f.name)}</small></td><td>${esc(d.name)}<br><small>S/N ${esc(d.serial)}</small></td><td>${fmtTime(f.start)}<br><small>to ${fmtTime(f.end)}</small></td><td>${f.params.altitude} m AGL<br><small>GSD ${p.gsd.toFixed(1)} cm/px</small></td><td>${f.photos}</td><td>${p.areaHa.toFixed(1)} ha</td></tr>`;
    }).join("");
    const detail = [...r.rows].sort((a, b) => SEVERITY[b.category].rank - SEVERITY[a.category].rank).filter((x) => x.category !== "none").map((x) => `
    <tr><td>${esc(x.structureId)}</td><td>${esc(x.address)}<br><small>${x.lat}, ${x.lon}</small></td><td>${x.type === "commercial" ? "Comm." : "Res."}</td>
    <td><span class="sw" style="background:${SEVERITY[x.category].color}"></span>${SEVERITY[x.category].label}</td>
    <td>${x.verified ? "\u2713 Pilot" : `AI ${Math.round(x.aiConfidence * 100)}%`}</td><td class="num">${money(x.loss)}</td><td>${esc(x.notes)}</td></tr>`).join("");
    const photos = embedImages ? r.rows.filter((x) => x.category === "destroyed" || x.category === "major").slice(0, 24).map((x) => {
      const f = state.findings.find((y) => y.id === x.findingId);
      const src = f?.photo || thumb(buildingById(x.structureId), 240, 170);
      return `<figure><img src="${src}" alt=""><figcaption><b>${esc(x.structureId)}</b> ${esc(x.address)} \u2014 ${SEVERITY[x.category].label}</figcaption></figure>`;
    }).join("") : "";
    return `
  <article class="report">
    <header class="rp-head">
      <div class="rp-logo">${LOGO_SVG}<div><b>${esc(r.pilot.org)}</b><br><small>UAS Damage Assessment \xB7 generated with Kalibr8</small></div></div>
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
      <div><small>Pilot-verified</small><b>${r.totals.verified} (${r.totals.structures ? Math.round(r.totals.verified / r.totals.structures * 100) : 0}%)</b></div>
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
    ${photos ? `<h2>4. Imagery \u2014 destroyed and major damage</h2><div class="rp-photos">${photos}</div>` : ""}
    <h2>${photos ? 5 : 4}. Structure detail</h2>
    <table class="rp-table small"><thead><tr><th>ID</th><th>Address / location</th><th>Type</th><th>Category</th><th>Assessed by</th><th class="num">Est. loss</th><th>Notes</th></tr></thead><tbody>${detail}</tbody></table>
    ${r.notes ? `<h2>Notes</h2><p>${esc(r.notes)}</p>` : ""}
    <h2>Methodology</h2>
    <p class="rp-small">Imagery was captured by sUAS in an autonomous grid pattern and processed on the field device with no internet connection. Damage categories follow FEMA PDA terminology (Destroyed, Major, Minor, Affected). Each structure was first categorized by an onboard model, then reviewed by the remote pilot where marked \u201C\u2713 Pilot\u201D. Estimated loss = assessed value \xD7 category factor (Destroyed ${r.factors.destroyed * 100}%, Major ${r.factors.major * 100}%, Minor ${r.factors.minor * 100}%, Affected ${r.factors.affected * 100}%) unless overridden by the pilot. Figures are preliminary and subject to field verification by the reviewing agency.</p>
    <div class="rp-sign"><div><span></span><small>Remote pilot signature / date</small></div><div><span></span><small>Reviewing official / date</small></div></div>
  </article>`;
  }
  function mapSVG(r) {
    const flights = r.flightIds.map(flightById).filter(Boolean);
    const pts = flights.flatMap((f) => f.poly);
    if (!pts.length) return "";
    const b = bbox(pts);
    const pad = 40;
    const x0 = b.x - pad, y0 = b.y - pad, w = b.x2 - b.x + pad * 2, hh = b.y2 - b.y + pad * 2;
    const c = city();
    const roads = c.roads.map((rd) => `<line x1="${rd.x1}" y1="${rd.y1}" x2="${rd.x2}" y2="${rd.y2}" stroke="#d9d9d9" stroke-width="${rd.w}"/>`).join("");
    const byB = new Map(r.rows.map((x) => [x.structureId, x.category]));
    const blds = c.buildings.filter((bl) => bl.x > x0 - 20 && bl.x < x0 + w && bl.y > y0 - 20 && bl.y < y0 + hh).map((bl) => {
      const cat = byB.get(bl.id);
      const fill = cat && cat !== "none" ? SEVERITY[cat].color : "#bdbdbd";
      return `<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" fill="${fill}"/>`;
    }).join("");
    const polys = flights.map((f) => `<polygon points="${f.poly.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#1f5fbf" stroke-width="3" stroke-dasharray="10 6"/>`).join("");
    const legend = SEVERITY_ORDER.slice(0, 4).map((k, i) => `<g transform="translate(${x0 + 12 + i * 120},${y0 + hh - 16})"><rect width="12" height="12" fill="${SEVERITY[k].color}"/><text x="18" y="11" font-size="14" fill="#333">${SEVERITY[k].label}</text></g>`).join("");
    return `<svg viewBox="${x0} ${y0} ${w} ${hh}" xmlns="http://www.w3.org/2000/svg"><rect x="${x0}" y="${y0}" width="${w}" height="${hh}" fill="#f4f4f2"/>${roads}${blds}${polys}<rect x="${x0 + 4}" y="${y0 + hh - 30}" width="490" height="26" fill="#fff" opacity=".85"/>${legend}</svg>`;
  }
  var LOGO_SVG = '<svg viewBox="304 474 1072 726" width="40" height="27" aria-label="Kalibr8"><path fill-rule="evenodd" fill="#111" d="M482.667 1012.19V1198.33H304V842.222L482.667 1012.19ZM890.934 474C930.267 474 957.913 474 977.268 474.072L586.18 818.757L984.841 1198H758.267L708.533 1149.07C600.8 1043.2 557.466 1002.4 409.333 867.2C393.6 852.801 376.668 837.467 371.867 833.2C366.934 828.934 363.2 824.933 363.467 824.399C364.277 823.191 448.803 750.798 483.867 721.333C575.334 644.533 629.067 596.4 733.601 497.6L758.667 474H890.934ZM1091.14 475.333C1167.42 475.333 1174.81 475.961 1203.12 484.915C1274.84 507.849 1326.59 563.141 1341.21 632.728C1344.99 650.478 1344.99 686.292 1341.21 705.456C1337.91 722.421 1329.26 745.197 1320.14 760.748C1308.03 781.482 1286.95 804.73 1269.18 817.454C1265.88 819.81 1263.36 822.166 1263.68 822.795C1263.83 823.266 1270.44 827.979 1278.15 833.006C1307.71 852.484 1334.14 882.172 1348.92 912.803C1374.24 965.268 1374.87 1026.69 1350.34 1079.94C1322.34 1140.88 1255.18 1186.44 1181.1 1194.61C1172.61 1195.55 1142.57 1196.33 1114.1 1196.33H1071.59L794.804 933.026L803.635 923.17C809.454 916.73 822.351 902.435 832.26 891.597C880.544 839.289 914.045 801.903 914.045 800.646C914.043 799.86 909.955 795.934 905.08 791.693C893.355 781.794 834.996 730.977 806.467 705.916L1068.1 475.333H1091.14ZM1111.12 879.973C1087.68 874.789 1062.99 878.088 1040.97 889.555C1027.91 896.309 1008.41 914.687 1001.33 926.782C985.135 954.585 983.719 988.515 997.56 1016.16C1014.55 1049.78 1045.22 1069.73 1083.28 1071.77C1113.95 1073.5 1139.58 1063.76 1160.97 1042.39C1183.46 1020.09 1193.22 992.285 1189.13 962.754C1183.62 922.698 1151.85 888.926 1111.12 879.973ZM482.667 574.933V639.55L304.005 797.012C304.032 619.92 304.334 474.333 304.334 474.333H482.334L482.667 574.933ZM1110.49 601.783C1087.05 596.757 1062.83 600.212 1040.97 611.521C1025.4 619.533 1006.37 638.697 998.661 654.091C979.63 691.947 986.708 734.831 1016.91 764.833C1035.46 783.211 1056.38 792.322 1083.28 793.735C1113.95 795.463 1139.58 785.724 1160.97 764.361C1196.83 728.704 1199.66 676.554 1168.05 636.655C1154.68 619.848 1132.51 606.339 1110.49 601.783Z"/></svg>';
  function openPreview(app2, r) {
    const paper = h("div", { class: "paper", html: reportHTML(r) });
    const m = modal({
      title: `${REPORT_TYPES[r.type].short} \xB7 ${r.id}`,
      wide: true,
      cls: "preview",
      body: paper,
      footer: [
        h("span", { class: `chip chip-status s-${STATUS[r.status][1]}` }, STATUS[r.status][0]),
        h("span", { class: "grow" }),
        btn("PDF / Print", { variant: "dark", icon: "print", onClick: () => printReport(r) }),
        btn("CSV", { variant: "dark", icon: "download", onClick: () => download(`${r.id}-structures.csv`, toCSV(r), "text/csv") }),
        btn("GeoJSON", { variant: "dark", icon: "download", onClick: () => download(`${r.id}.geojson`, toGeoJSON(r), "application/geo+json") }),
        btn("Share / AirDrop", { variant: "dark", icon: "share", onClick: () => shareReport(r) }),
        r.status === "delivered" ? null : btn(r.status === "queued" ? "Queued" : `Send to ${shortRecipient(r.recipient)}`, { icon: "send", disabled: r.status === "queued" || r.status === "sending", onClick: () => {
          send(app2, r);
          m.close();
        } })
      ]
    });
  }
  var shortRecipient = (s2) => s2.split("\u2014")[0].trim();
  function send(app2, r) {
    if (app2.isOnline()) {
      deliver(app2, r);
      toast(`Sending ${r.id}\u2026`);
    } else {
      r.status = "queued";
      r.queuedAt = Date.now();
      emit("report");
      toast("Offline \u2014 report queued. It will send automatically when a connection is available.", "warn");
    }
  }
  async function deliver(app2, r) {
    r.status = "sending";
    emit("report");
    const endpoint = state.settings.endpoint;
    try {
      if (endpoint) {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, html: reportHTML(r, { embedImages: false }) }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await new Promise((res) => setTimeout(res, 1800));
      }
      r.status = "delivered";
      r.deliveredAt = Date.now();
      toast(`${r.id} delivered to ${shortRecipient(r.recipient)}`, "ok");
    } catch (e) {
      r.status = "failed";
      toast(`Send failed (${e.message}). Will retry.`, "err");
    }
    emit("report");
  }
  var busy2 = false;
  async function processOutbox(app2) {
    if (busy2 || !app2.isOnline()) return;
    const q = state.reports.filter((r) => r.status === "queued" || r.status === "failed");
    if (!q.length) return;
    busy2 = true;
    for (const r of q) await deliver(app2, r);
    busy2 = false;
  }
  function toCSV(r) {
    const cols = ["report_id", "structure_id", "address", "latitude", "longitude", "structure_type", "damage_category", "ai_category", "ai_confidence", "pilot_verified", "assessed_value_usd", "estimated_loss_usd", "notes", "flight_id", "captured_at"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = r.rows.map((x) => [r.id, x.structureId, x.address, x.lat, x.lon, x.type, SEVERITY[x.category].label, SEVERITY[x.aiCategory].label, x.aiConfidence, x.verified ? "yes" : "no", x.value, x.loss, x.notes, x.flightId, new Date(x.capturedAt).toISOString()].map(q).join(","));
    return [cols.join(","), ...lines].join("\n");
  }
  function toGeoJSON(r) {
    return JSON.stringify({
      type: "FeatureCollection",
      properties: { report_id: r.id, incident: r.incident, generated: new Date(r.created).toISOString(), recipient: r.recipient },
      features: [
        ...r.flightIds.map(flightById).filter(Boolean).map((f) => ({ type: "Feature", properties: { kind: "survey_area", flight_id: f.id, name: f.name }, geometry: { type: "Polygon", coordinates: [[...f.poly, f.poly[0]].map(([x, y]) => {
          const c = toLatLon(x, y);
          return [+c.lon.toFixed(6), +c.lat.toFixed(6)];
        })] } })),
        ...r.rows.map((x) => ({ type: "Feature", properties: { kind: "structure", id: x.structureId, address: x.address, category: x.category, verified: x.verified, estimated_loss_usd: x.loss, notes: x.notes }, geometry: { type: "Point", coordinates: [x.lon, x.lat] } }))
      ]
    }, null, 2);
  }
  function standaloneHTML(r) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${r.id}</title><style>${REPORT_CSS}</style></head><body>${reportHTML(r)}</body></html>`;
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4e3);
    toast(`Saved ${name}`);
  }
  async function shareReport(r) {
    const files = [
      new File([standaloneHTML(r)], `${r.id}-report.html`, { type: "text/html" }),
      new File([toCSV(r)], `${r.id}-structures.csv`, { type: "text/csv" })
    ];
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title: `${REPORT_TYPES[r.type].short} ${r.id}` });
      } catch (e) {
      }
    } else {
      download(`${r.id}-report.html`, standaloneHTML(r), "text/html");
    }
  }
  function printReport(r) {
    const root = document.getElementById("print-root");
    root.innerHTML = reportHTML(r);
    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      root.innerHTML = "";
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 50);
  }
  var REPORT_CSS = `
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

  // js/views/settings.js
  function openSettings(app2) {
    const s2 = state.settings;
    const inp = (obj, key, type = "text") => h("input", { class: "input", type, value: obj[key], onchange: (e) => {
      obj[key] = type === "number" ? +e.target.value : e.target.value;
      emit("settings");
    } });
    const pctIn = (key) => h("input", { class: "input", type: "number", min: 0, max: 100, value: Math.round(s2.factors[key] * 100), onchange: (e) => {
      s2.factors[key] = +e.target.value / 100;
      emit("settings");
    } });
    const m = modal({
      title: "Settings",
      cls: "settings",
      body: h(
        "div",
        { class: "stack" },
        h("div", { class: "eyebrow" }, "Remote pilot"),
        h("div", { class: "grid2" }, field("Name", inp(s2.pilot, "name")), field("Certificate", inp(s2.pilot, "cert"))),
        field("Organization", inp(s2.pilot, "org")),
        h("div", { class: "eyebrow" }, "Loss estimate factors (% of assessed value)"),
        h("div", { class: "grid4" }, field("Destroyed", pctIn("destroyed")), field("Major", pctIn("major")), field("Minor", pctIn("minor")), field("Affected", pctIn("affected"))),
        h("div", { class: "eyebrow" }, "Delivery"),
        field("Report endpoint (optional)", h("input", { class: "input", type: "url", placeholder: "https://\u2026 \u2014 leave blank to simulate delivery", value: s2.endpoint || "", onchange: (e) => {
          s2.endpoint = e.target.value.trim();
          emit("settings");
        } }), "Queued reports are POSTed here as JSON once the device is online."),
        field("Network mode", h(
          "select",
          { class: "input", onchange: (e) => {
            s2.network = e.target.value;
            emit("settings");
            app2.rerender();
          } },
          [["auto", "Automatic (use device connection)"], ["offline", "Force offline (demo)"], ["online", "Force online (demo)"]].map(([v, l]) => h("option", { value: v, selected: s2.network === v }, l))
        )),
        h("div", { class: "eyebrow" }, "Prototype"),
        field("Flight simulation speed", h("select", { class: "input", onchange: (e) => {
          s2.simSpeed = +e.target.value;
          emit("settings");
        } }, [1, 5, 10, 25, 50].map((v) => h("option", { value: v, selected: s2.simSpeed === v }, `${v}\xD7`)))),
        h(
          "div",
          { class: "row-actions" },
          btn("Load sample survey", { variant: "dark", small: true, onClick: () => {
            const f = loadSample();
            ui.selectedFlight = f.id;
            m.close();
            toast("Sample survey loaded");
            app2.go("review");
          } }),
          btn("Reset all data", { variant: "danger", small: true, onClick: async () => {
            if (await confirmDialog("Reset all data?", "Flights, findings, annotations and reports on this device will be erased.", "Reset")) {
              reset();
              m.close();
              location.reload();
            }
          } })
        )
      )
    });
  }

  // js/main.js
  var VIEWS = { drones: drones_exports, flights: flights_exports, review: review_exports, reports: reports_exports };
  var drawer = document.getElementById("drawer");
  var map = createMap(document.getElementById("map"));
  var app = { map, go, refreshMap, rerender, isOnline };
  var NAV = [
    { id: "drones", icon: "drone", label: "Connect drone" },
    { id: "flights", icon: "list", label: "Flight log & planning" },
    { id: "review", icon: "addLocation", label: "Damage review" },
    { id: "reports", icon: "chart", label: "Reports" }
  ];
  var rail = document.getElementById("rail-nav");
  NAV.forEach((n) => rail.append(h("button", { class: "rail-btn", "data-panel": n.id, title: n.label, "aria-label": n.label, onclick: () => go(n.id) }, icon(n.icon))));
  document.getElementById("btn-layers").append(icon("layers"));
  document.getElementById("btn-settings").append(icon("settings"));
  document.getElementById("btn-fit").append(icon("area"));
  document.getElementById("drawer-open").append(icon("collapse"));
  document.getElementById("drawer-open").addEventListener("click", () => {
    document.body.classList.remove("drawer-collapsed");
  });
  document.head.append(h("style", {}, REPORT_CSS));
  document.getElementById("btn-layers").addEventListener("click", openLayers);
  document.getElementById("btn-settings").addEventListener("click", () => openSettings(app));
  document.getElementById("zoom-in").addEventListener("click", map.zoomIn);
  document.getElementById("zoom-out").addEventListener("click", map.zoomOut);
  document.getElementById("btn-fit").addEventListener("click", () => fitToContext());
  var STEPS = [
    { id: "drones", label: "Connect" },
    { id: "flights", label: "Plan" },
    { id: "fly", label: "Fly" },
    { id: "review", label: "Review" },
    { id: "reports", label: "Report" }
  ];
  function stepDone(id) {
    if (id === "drones") return !!state.connectedId;
    if (id === "flights") return state.flights.length > 0;
    if (id === "fly") return state.flights.some((f) => f.status === "completed");
    if (id === "review") return state.findings.some((f) => f.verified);
    if (id === "reports") return state.reports.length > 0;
  }
  function renderStepper() {
    const el2 = document.getElementById("stepper");
    const current = ui.panel === "flights" && live.flightId ? "fly" : ui.panel;
    el2.replaceChildren(...STEPS.map((s2, i) => h(
      "button",
      { class: `step ${stepDone(s2.id) ? "done" : ""} ${current === s2.id ? "cur" : ""}`, onclick: () => go(s2.id === "fly" ? "flights" : s2.id) },
      h("span", { class: "step-n" }, stepDone(s2.id) ? icon("check") : String(i + 1)),
      h("span", { class: "step-l" }, s2.label)
    )));
  }
  function isOnline() {
    const m = state.settings.network;
    return m === "auto" ? navigator.onLine : m === "online";
  }
  function renderNet() {
    const on2 = isOnline();
    const d = connectedDrone();
    document.getElementById("net-pill").replaceChildren(icon(on2 ? "cloudDone" : "cloudOff"), h("span", {}, on2 ? "Online" : "Offline mode"));
    document.getElementById("net-pill").className = `pill ${on2 ? "ok" : "warn"}`;
    document.getElementById("rail-net").replaceChildren(icon(on2 ? "cloudDone" : "cloudOff"), h("span", {}, on2 ? "Online" : "Offline"));
    document.getElementById("rail-net").className = `rail-net ${on2 ? "ok" : "warn"}`;
    const lp = document.getElementById("link-pill");
    lp.className = `pill ${d ? "ok" : "off"}`;
    lp.replaceChildren(icon("drone"), h("span", {}, d ? `${d.name} \xB7 ${linkLabel(state.link?.method)}` : "No drone linked"));
    lp.onclick = () => go("drones");
    const q = state.reports.filter((r) => r.status === "queued").length;
    const ob = document.getElementById("outbox-pill");
    ob.hidden = !q;
    ob.replaceChildren(icon("send"), h("span", {}, `${q} queued`));
    ob.onclick = () => go("reports");
  }
  var linkLabel = (m) => ({ usb: "Controller USB-C", wifi: "Drone Wi-Fi", ble: "Bluetooth LE" })[m] || "Direct link";
  window.addEventListener("online", () => {
    renderNet();
    processOutbox(app);
  });
  window.addEventListener("offline", renderNet);
  setInterval(() => processOutbox(app), 4e3);
  function go(panel) {
    ui.panel = panel;
    document.body.classList.remove("drawer-collapsed");
    if (panel !== "flights" && !live.flightId) ui.annotateMode = false;
    rerender();
    fitToContext();
  }
  function rerender() {
    document.querySelectorAll(".rail-btn").forEach((b) => b.classList.toggle("active", b.dataset.panel === ui.panel));
    const v = VIEWS[ui.panel];
    const scroll = drawer.querySelector(".drawer-body")?.scrollTop || 0;
    drawer.replaceChildren(v.render(app));
    const body = drawer.querySelector(".drawer-body");
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
  var HOME = { x: 1110, y: 1180, heading: -Math.PI / 2 };
  function refreshMap() {
    const L = ui.layers;
    map.showBuildings(L.buildings);
    const flight = flightById(ui.selectedFlight);
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
    const inReview = ui.panel === "review" || ui.panel === "reports";
    const flightIds = flight ? [flight.id] : state.flights.map((f) => f.id);
    const showFindings = L.findings && (inReview || flight && flight.status !== "planned");
    const fs = showFindings ? filteredFindings(flightIds) : [];
    map.renderDamage(inReview ? fs : [], buildingById);
    const markers = [];
    fs.forEach((f) => {
      const b = buildingById(f.buildingId);
      const sev = f.severityFinal || f.severity;
      if (sev === "none" && !inReview) return;
      markers.push({ id: f.id, kind: "finding", x: b.x + b.w / 2, y: b.y + b.h / 2, color: SEVERITY[sev].color, selected: ui.selectedFinding === f.id, verified: f.verified });
    });
    if (L.annotations) filteredAnnotations(flightIds).forEach((a) => markers.push({ id: a.id, kind: "annotation", x: a.x, y: a.y, selected: ui.selectedFinding === a.id }));
    map.renderMarkers(markers);
    const d = connectedDrone();
    if (live.flightId && live.pos) map.renderDrone(live.pos, live.plan?.footW);
    else if (d) map.renderDrone(HOME);
    else map.renderDrone(null);
    document.body.classList.toggle("annotating", ui.annotateMode);
    document.body.classList.toggle("drawing", ui.drawMode);
  }
  map.onClick((e) => {
    if (ui.drawMode && ui.draft) {
      if (e.kind) return;
      ui.draft.poly.push([Math.round(e.x), Math.round(e.y)]);
      refreshMap();
      renderDrawBar(app);
      return;
    }
    if (e.kind === "finding") {
      ui.selectedFinding = e.target;
      if (ui.panel !== "review") ui.panel = "review";
      rerender();
      scrollToSelected();
      return;
    }
    if (e.kind === "annotation") {
      openAnnotation(app, { id: e.target });
      return;
    }
    if (ui.annotateMode) {
      openAnnotation(app, { x: e.x, y: e.y });
      return;
    }
  });
  map.onVertex((i, [x, y]) => {
    if (ui.draft) {
      ui.draft.poly[i] = [Math.round(x), Math.round(y)];
      refreshMap();
    }
  }, () => renderDrawBar(app));
  onTick(() => {
    if (live.pos) {
      refreshMapLight();
    }
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
    if (what === "tick") {
      if (ui.panel === "flights" || ui.panel === "review") rerender();
      return;
    }
    rerender();
  });
  function openLayers() {
    const row = (key, label) => h(
      "label",
      { class: "switch-row" },
      h("span", {}, label),
      h("input", { type: "checkbox", class: "switch", checked: ui.layers[key], onchange: (e) => {
        ui.layers[key] = e.target.checked;
        refreshMap();
      } })
    );
    modal({ title: "Map layers", body: h(
      "div",
      { class: "stack" },
      row("buildings", "Building footprints"),
      row("plan", "Flight plan & path"),
      row("findings", "Damage findings"),
      row("annotations", "Annotations"),
      h("p", { class: "muted small" }, "Basemap is stored on this device \u2014 no internet or map tiles required.")
    ) });
  }
  if (!ui.selectedFlight && state.flights[0]) ui.selectedFlight = state.flights[0].id;
  state.flights.forEach((f) => {
    if (f.status === "in-progress") f.status = "paused";
  });
  go(state.connectedId ? "flights" : "drones");
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").then(() => {
      if (!localStorage.getItem("uav-offline-ready")) {
        localStorage.setItem("uav-offline-ready", "1");
        toast("Saved for offline use \u2014 this app now works with no connection.");
      }
    }).catch(() => {
    });
  }
  window.__app = app;
})();
