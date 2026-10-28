<img src="assets/k8-icon.svg" alt="Kalibr8 (K8)" width="72">

# Kalibr8 (K8) — offline UAV damage survey

Kalibr8 (K8) is a responsive web-app prototype for a disaster-relief sUAS pilot working **with no internet** after a hurricane. It runs entirely in the browser on whatever device the pilot carries (laptop, tablet or phone): connect the drone over a direct link, plan an autonomous survey, review AI-flagged damage, and generate reports for the regulatory reviewer that are queued until a connection returns.

Kalibr8 revisits **Slingshot Edge**, a 2020 MVP companion app that generated FEMA damage reports. The visual design starts from the Slingshot Edge Figma file (dark Material theme, 64 px app rail, 514 px side drawer, flight-log table rows, status/battery/signal chips, annotation popover, picture-in-picture feed) and adds offline-first behaviour and a matching Android design.

## User journey

| Step | Where | What happens |
|---|---|---|
| 1. Connect drone | Rail → drone icon | Pick a link (controller USB-C, drone Wi-Fi, Bluetooth LE), scan, connect. Battery / signal / GPS / storage shown. |
| 2. Plan flight | Rail → list icon → **New flight** | 3-step wizard: select sUAS → draw survey polygon on the map + altitude/speed/overlap (live estimates for area, time, photos, GSD, battery swaps) → pre-flight checklist. |
| 3. Fly | Flight Log → **Start flight** | Autonomous lawnmower mission with live telemetry, flown path, camera footprint, PiP feed, Hold / Return home, battery-swap-and-resume, and **Annotate** (tap the map to drop notes). Onboard "AI" flags structures as they're imaged. |
| 4. Review damage | Rail → pin icon | Counts and estimated loss by FEMA PDA category (Destroyed / Major / Minor / Affected). Verify or re-categorize each structure, add notes, override cost, attach a ground photo, bulk-accept ≥90% confidence. Annotations tab mirrors the Figma annotations log. |
| 5. Report | Rail → chart icon | Generate a FEMA PDA summary, State EOC sitrep or County IDA. Preview → PDF/Print, CSV, GeoJSON, Share with AirDrop or Quick Share (works without internet), or **Send** — offline sends are queued and delivered automatically when the device is back online. |

Want to skip to steps 4–5? **Settings → Load sample survey**, or "Load sample completed survey" in an empty Flight Log.

## Run it

**Quickest:** double-click `index.html`. Everything works from the file, except the offline install (that part needs a web address — see below).

Or serve the folder:

```bash
python3 -m http.server 8080      # then open http://localhost:8080
```

### Editing the code

Source lives in `js/` as ES modules. `index.html` loads the single bundled file `js/app.bundle.js` so the app also runs when opened straight from disk. After changing anything in `js/`, rebuild the bundle:

```bash
npm install        # once
npm run build
```

### Deploy to GitHub Pages

1. Push this folder to a repo.
2. **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Open the Pages URL on the pilot's device.

### Use it offline

1. Open the URL once while online (you'll see "Saved for offline use").
2. Install it: Safari → Share → **Add to Home Screen**, or Chrome → **Install app** on Android and desktop.
3. Launch from the home screen in airplane mode — everything (map, planning, review, reports) works. Data is stored on the device (`localStorage`).

**Settings → Network mode** lets you force offline/online to demo the outbox without touching Wi-Fi.

## Project structure

```
index.html              app shell (loads js/app.bundle.js)
package.json            `npm run build` bundles js/ into js/app.bundle.js
css/app.css             styles (Figma tokens at the top)
sw.js                   service worker — caches the app for offline use
manifest.webmanifest    install-to-home-screen metadata
assets/                 Kalibr8 logo (k8-mark.svg, k8-icon.svg) + app icons
js/
  main.js               boot, navigation, map layers, network/outbox status
  store.js              state + persistence, sample data, cost totals
  geo.js                offline basemap generator, survey-grid math, coordinates
  map.js                SVG map with pan / pinch / zoom, markers, polygon editing
  feed.js               procedural aerial imagery (live feed + thumbnails)
  sim.js                drone link + mission simulator  ← replace for real hardware
  ui.js                 DOM helpers, icons, chips, modal, toast
  views/                drones, flights (log + wizard), flight-hud, review, annotate, reports, settings
```

## What's simulated (prototype boundaries)

- **Drone link & flight** — `js/sim.js`. Mobile Safari has no Web Bluetooth / WebUSB / WebSerial (and support varies on Android), so a production build would either wrap this app in a native shell (e.g. Capacitor + the vendor SDK or MAVLink) or talk to a bridge on the controller over a local WebSocket. Only `sim.js` needs replacing; the UI uses its small API (`scan`, `connect`, `start`, `pause`, `resume`, `stop`, `onTick`).
- **Basemap** — a generated street grid (styled after the Figma map, Miami street names). Swap in offline vector tiles (e.g. PMTiles + MapLibre) for real areas.
- **Imagery and AI detections** — procedurally drawn and deterministic. Replace with frames/images from the drone and a real on-device model.
- **Damage costs** — assessed value × category factor (editable in Settings). Placeholder values, clearly labeled as preliminary in the report.
- **Report delivery** — simulated unless you set **Settings → Report endpoint**; queued reports are then POSTed as JSON.

## Customizing

- Logo: `assets/k8-mark.svg` (rail mark) and `assets/k8-icon.svg` (app icon, also rendered to `icon-192.png` / `icon-512.png`). The report header embeds the same mark in `js/views/reports.js`.
- Colors / type: CSS variables at the top of `css/app.css`. The design uses Inter; it falls back to the system font so nothing loads from the network — drop an Inter `.woff2` into `assets/` and add an `@font-face` if you want an exact match.
- When you change any file, run `npm run build` and bump `CACHE` in `sw.js` so installed copies pick up the update.
