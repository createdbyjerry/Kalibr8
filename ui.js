// Small DOM + component helpers shared by every view.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.entries(v).forEach(([sk, sv]) => (sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv)));
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach((c) => c != null && c !== false && el.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return el;
}

const P = {
  list: 'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
  layers: 'M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z',
  checklist: 'M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z',
  addLocation: 'M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm4 8h-3v3h-2v-3H8V8h3V5h2v3h3v2z',
  place: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  chart: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  account: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  collapse: 'M12.41 16.59L8.83 13H23v-2H8.83l3.58-3.59L11 6l-6 6 6 6 1.41-1.41zM4 18V6H2v12h2z',
  expandLess: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  expandMore: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  cloudOff: 'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  cloudDone: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  check: 'M9 16.17L4.83 12l-1.42 1.42L9 19 21 7l-1.41-1.41z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  share: 'M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z',
  usb: 'M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93 0-1.21-.99-2.2-2.2-2.2-1.21 0-2.2.99-2.2 2.2 0 .85.5 1.56 1.2 1.93V13c0 1.11.89 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95 0 1.22.99 2.2 2.2 2.2 1.21 0 2.2-.98 2.2-2.2 0-.85-.49-1.58-1.2-1.95V15h3c1.11 0 2-.89 2-2v-2h1V7h-4z',
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  bluetooth: 'M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z',
  area: 'M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z',
  undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  video: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  takeoff: 'M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z',
  land: 'M2.5 19h19v2h-19v-2zm7.18-5.73l4.35 1.16 5.31 1.42c.8.21 1.62-.26 1.84-1.06.21-.8-.26-1.62-1.06-1.84l-5.31-1.42-2.76-9.02L10.12 2v8.28L5.15 8.95l-.93-2.32-1.45-.39v5.17l1.6.43 5.31 1.43z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
  arrow: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  sd: 'M18 2h-8L4.02 8 4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 6h-2V4h2v4zm3 0h-2V4h2v4zm3 0h-2V4h2v4z',
};

const DRONE_SVG = '<svg viewBox="0 0 24 24" class="ic"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><path d="M8 8l2.2 2.2M16 8l-2.2 2.2M8 16l2.2-2.2M16 16l-2.2-2.2"/></g><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor"/></svg>';

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icw ${cls}`;
  span.innerHTML = name === 'drone' ? DRONE_SVG : `<svg viewBox="0 0 24 24" class="ic"><path d="${P[name]}" fill="currentColor"/></svg>`;
  return span;
}
export const iconPath = (name) => P[name];

export function btn(label, opts = {}) {
  const { variant = 'primary', icon: ic, onClick, disabled, small, title, cls = '' } = opts;
  return h('button', { class: `btn btn-${variant} ${small ? 'btn-sm' : ''} ${cls}`, onclick: onClick, disabled, title, type: 'button' }, ic ? icon(ic) : null, label ? h('span', {}, label) : null);
}

export function chip(label, opts = {}) {
  const { onDelete, variant = 'basic', onClick, color, active } = opts;
  const el = h('span', { class: `chip chip-${variant} ${active ? 'active' : ''} ${onClick ? 'clickable' : ''}`, onclick: onClick, style: color ? { '--chip-dot': color } : null },
    color ? h('i', { class: 'dot' }) : null, h('span', { class: 'chip-label' }, label),
    onDelete ? h('button', { class: 'chip-x', type: 'button', 'aria-label': `Remove ${label}`, onclick: (e) => { e.stopPropagation(); onDelete(); } }, icon('close')) : null);
  return el;
}

export function batteryChip(pct, connected = true) {
  const lvl = !connected || pct <= 0 ? 'off' : pct <= 20 ? 'warn' : 'ok';
  const fill = Math.max(0, Math.min(100, pct));
  return h('span', { class: `chip chip-status s-${lvl}` }, h('span', {}, connected ? `${pct}%` : '0%'),
    h('span', { class: 'batt', html: `<i style="height:${connected ? fill : 0}%"></i>` }));
}

export function signalChip(sig) {
  const map = { strong: ['Strong', 'ok', 4], weak: ['Weak', 'warn', 2], none: ['Signal', 'off', 0] };
  const [label, lvl, bars] = map[sig] || map.none;
  const b = [1, 2, 3, 4].map((i) => `<i class="${i <= bars ? 'on' : ''}" style="height:${i * 25}%"></i>`).join('');
  return h('span', { class: `chip chip-status s-${lvl}` }, h('span', {}, label), h('span', { class: 'bars', html: b }));
}

export function statusChip(status) {
  const map = { live: ['Live', 'ok', 'video'], playback: ['Playback', 'info', 'play'], off: ['Disconnected', 'off', 'video'] };
  const [label, lvl, ic] = map[status] || map.off;
  return h('span', { class: `chip chip-status s-${lvl}` }, h('span', {}, label), icon(ic, 'chip-ic'));
}

let toastT;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.className = `toast show ${kind}`;
  el.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.className = 'toast'), 3200);
}

export function modal({ title, body, footer, wide, onClose, cls = '' }) {
  const root = document.getElementById('modal-root');
  const close = () => { wrap.remove(); onClose?.(); };
  const wrap = h('div', { class: 'backdrop', onclick: (e) => e.target === wrap && close() },
    h('div', { class: `dialog ${wide ? 'wide' : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'dialog-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('close'))),
      h('div', { class: 'dialog-body' }, body),
      footer ? h('div', { class: 'dialog-foot' }, footer) : null));
  root.append(wrap);
  return { close, el: wrap };
}

export function confirmDialog(title, text, okLabel = 'Confirm') {
  return new Promise((res) => {
    const m = modal({ title, body: h('p', { class: 'muted' }, text), onClose: () => res(false),
      footer: [btn('Cancel', { variant: 'dark', onClick: () => { m.close(); } }), btn(okLabel, { onClick: () => { res(true); m.el.remove(); } })] });
  });
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
export const fmtTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
export const fmtDur = (s) => { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function drawerHeader(title, extra) {
  return h('div', { class: 'drawer-head' }, h('h1', {}, title), extra || null,
    h('button', { class: 'icon-btn', 'aria-label': 'Collapse panel', onclick: () => document.body.classList.toggle('drawer-collapsed') }, icon('collapse')));
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('p', {}, text), action || null);
}
