// Contact details -> animated comms-radio SVG in the Flight Path Radar phosphor palette.

const W = 960;
const COMMS_H = 176, STATUS_H = 80, GAP = 12;   // panel heights (with titles) and spacing
const TITLE_H = 14;                              // room the panel title row takes
const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const CHAR = 0.62;                               // monospace advance, as a fraction of font size

const T = {
  bg: "#020d07", panel: "#03140b", border: "#14522d", grid: "#0f3d22",
  text: "#5dff95", dim: "#2fc062", faint: "#1c8443", off: "#0b3a1f",
  amber: "#ffb347", lamp: "#0b3a1f", stby: "#2a1d08",
};
const GUARD = "121.500";

const f = (n) => +n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const text = (x, y, s, { size = 11, fill = T.text, anchor = "start", weight = "", opacity = "", extra = "", children = "" } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"` +
  `${weight ? ` font-weight="${weight}"` : ""}${opacity ? ` opacity="${opacity}"` : ""}${extra}>${esc(s)}${children}</text>`;

const label = (x, y, s, anchor = "start") => text(x, y, s, { size: 9, fill: T.faint, anchor, extra: ` letter-spacing="1.5"` });

// Bezel with corner brackets and an optional title tab.
function panel(x, y, w, h, title) {
  const b = 10, c = (px, py, dx, dy) => `M${px + dx * b},${py}L${px},${py}L${px},${py + dy * b}`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${T.panel}" stroke="${T.border}"/>` +
    `<path d="${c(x, y, 1, 1)}${c(x + w, y, -1, 1)}${c(x, y + h, 1, -1)}${c(x + w, y + h, -1, -1)}" fill="none" stroke="${T.dim}" stroke-width="1.5"/>` +
    (title == null ? "" : text(x + 12, y + 16, title, { size: 10, fill: T.dim, weight: 700, extra: ` letter-spacing="1.5"` }));
}

// Rotary knob with tick marks; the pointer swings while the panel tunes in, then rests at its own angle.
function knob(cx, cy, r, name, rest, sweep, begin) {
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const a = (-135 + i * 33.75) * Math.PI / 180;
    return `M${f(cx + Math.sin(a) * (r + 3))},${f(cy - Math.cos(a) * (r + 3))}L${f(cx + Math.sin(a) * (r + 6))},${f(cy - Math.cos(a) * (r + 6))}`;
  }).join("");
  return `<path d="${ticks}" stroke="${T.faint}" stroke-width="1"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${T.bg}" stroke="${T.border}" stroke-width="1.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.55)}" fill="${T.panel}" stroke="${T.grid}"/>` +
    `<g transform="rotate(${rest} ${cx} ${cy})"><line x1="${cx}" y1="${f(cy - r * 0.3)}" x2="${cx}" y2="${f(cy - r + 2)}" stroke="${T.text}" stroke-width="2" stroke-linecap="round"/>` +
    `<animateTransform attributeName="transform" type="rotate" values="${rest - sweep} ${cx} ${cy};${rest + sweep / 3} ${cx} ${cy};${rest} ${cx} ${cy}" dur="1.1s" begin="${begin}s" fill="freeze"/></g>` +
    label(cx, cy + r + 15, name, "middle");
}

// Frequency readout: the digits run through a few channels on load, then lock onto the comms frequency.
function frequency(s, x, y, w) {
  const out = [label(x, y + 10, "COM 1 · ACTIVE"), label(x + w, y + 10, "MHz", "end"),
    `<rect x="${x}" y="${y + 16}" width="${w}" height="56" rx="4" fill="${T.bg}" stroke="${T.border}"/>`,
    text(x + w / 2, y + 57, "888.888", { size: 32, anchor: "middle", fill: T.off, weight: 700, extra: ` textLength="140" lengthAdjust="spacingAndGlyphs"` })];
  const steps = ["118.000", "119.475", GUARD, "123.450"], dt = 0.12, t0 = 0.3;
  // textLength pins every readout to the ghost segments, whatever monospace font the viewer has.
  const digits = (v) => text(x + w / 2, y + 57, v, { size: 32, anchor: "middle", weight: 700, extra: ` textLength="${v.length * 20}" lengthAdjust="spacingAndGlyphs" filter="url(#glow)"` });
  steps.forEach((v, i) => out.push(`<g opacity="0">${digits(v)}<set attributeName="opacity" to="1" begin="${f(t0 + i * dt)}s"/>` +
    `<set attributeName="opacity" to="0" begin="${f(t0 + (i + 1) * dt)}s"/></g>`));
  out.push(`<g opacity="0">${digits(s.frequency)}<set attributeName="opacity" to="1" begin="${f(t0 + steps.length * dt)}s"/></g>`);
  out.push(text(x, y + 90, `STBY ${GUARD}`, { size: 11, fill: T.dim, extra: ` letter-spacing="1"` }),
    text(x + w, y + 90, "⇄ GUARD", { size: 11, fill: T.faint, anchor: "end", extra: ` letter-spacing="1"` }));
  return out.join("\n");
}

// Station display: the email types itself out, then a block cursor blinks after it.
// With the email off, the panel is receive-only and the display just listens.
function station(s, x, y, w) {
  if (!s.email) {
    return [label(x, y + 10, "STATION"), label(x + w, y + 10, "CH 01", "end"),
      `<rect x="${x}" y="${y + 16}" width="${w}" height="44" rx="4" fill="${T.bg}" stroke="${T.border}"/>`,
      text(x + w / 2, y + 44, `RECEIVE ONLY · LISTENING ON ${s.frequency}`, { size: 14, anchor: "middle", fill: T.dim, weight: 700, extra: ` letter-spacing="1.5"`,
        children: `<animate attributeName="opacity" values="1;0.45;1" dur="2.4s" repeatCount="indefinite"/>` }),
    ].join("\n");
  }
  const n = s.email.length, size = Math.min(20, Math.floor((w - 28) / (n * CHAR))), tw = n * size * CHAR;
  const tx = x + 14, ty = y + 45, typed = f(Math.min(1.6, n * 0.04)), t0 = 0.6;
  return [label(x, y + 10, "STATION · E-MAIL"), label(x + w, y + 10, "CH 01", "end"),
    `<rect x="${x}" y="${y + 16}" width="${w}" height="44" rx="4" fill="${T.bg}" stroke="${T.border}"/>`,
    `<clipPath id="typed"><rect x="${tx - 2}" y="${y + 18}" width="0" height="40"><animate attributeName="width" begin="${t0}s" dur="${typed}s" fill="freeze" calcMode="discrete" values="${Array.from({ length: n + 1 }, (_, i) => f(i * size * CHAR + 2)).join(";")}"/></rect></clipPath>`,
    `<g clip-path="url(#typed)">${text(tx, ty, s.email, { size, weight: 700, extra: ` textLength="${f(tw)}" lengthAdjust="spacingAndGlyphs" filter="url(#glow)"` })}</g>`,
    `<rect x="${f(tx + tw + 3)}" y="${f(ty - size * 0.8)}" width="${f(size * 0.55)}" height="${f(size * 0.95)}" fill="${T.text}" opacity="0">` +
      `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.01;0.5;0.51;1" begin="${f(t0 + typed)}s" dur="1s" repeatCount="indefinite"/></rect>`,
  ].join("\n");
}

// Scope: a data burst scrolling across a gridded oscilloscope.
function scope(x, y, w, h) {
  const P = 160, mid = y + h / 2, a = h / 2 - 5, pts = [];
  for (let i = 0; i <= w + P; i += 1) {
    const u = (i % P) / P, env = 0.15 + 0.85 * Math.abs(Math.sin(2 * Math.PI * u) * Math.sin(5 * Math.PI * u));
    const v = 0.7 * Math.sin(2 * Math.PI * 29 * u) + 0.3 * Math.sin(2 * Math.PI * 47 * u + 1);
    pts.push(`${i ? "L" : "M"}${f(x + i)},${f(mid - a * env * v)}`);
  }
  const grid = Array.from({ length: Math.floor(w / 40) }, (_, i) => `M${x + 40 * (i + 1)},${y}V${y + h}`).join("") + `M${x},${mid}H${x + w}`;
  return `<clipPath id="scope"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${T.bg}" stroke="${T.border}"/>` +
    `<path d="${grid}" stroke="${T.grid}" stroke-width="1" stroke-dasharray="2 3"/>` +
    `<g clip-path="url(#scope)"><path d="${pts.join("")}" fill="none" stroke="${T.text}" stroke-width="1.5" filter="url(#glow)">` +
    `<animateTransform attributeName="transform" type="translate" from="0 0" to="${-P} 0" dur="1.6s" repeatCount="indefinite"/></path></g>`;
}

// TX/RX lamps, signal meter and the push-to-talk plate. Without an email the transmitter is dark.
function transmit(x, y, w, tx) {
  const lw = (w - 10) / 2, out = [label(x, y + 10, "XMTR"), label(x + w, y + 10, "RCVR", "end")];
  // TX keys in short bursts, as if a message is going out; RX holds steady.
  if (!tx) out.push(`<rect x="${x}" y="${y + 16}" width="${f(lw)}" height="40" rx="4" fill="${T.panel}" stroke="${T.border}"/>`,
    text(x + lw / 2, y + 41, "TX", { size: 14, anchor: "middle", weight: 700, fill: T.faint }));
  else out.push(`<rect x="${x}" y="${y + 16}" width="${f(lw)}" height="40" rx="4" fill="${T.stby}" stroke="${T.amber}">` +
    `<animate attributeName="fill" values="${T.stby};${T.amber};${T.stby};${T.amber};${T.stby};${T.stby}" keyTimes="0;0.08;0.2;0.28;0.4;1" dur="2.4s" repeatCount="indefinite"/></rect>`,
    text(x + lw / 2, y + 41, "TX", { size: 14, anchor: "middle", weight: 700, fill: T.amber,
      children: `<animate attributeName="fill" values="${T.amber};${T.bg};${T.amber};${T.bg};${T.amber};${T.amber}" keyTimes="0;0.08;0.2;0.28;0.4;1" dur="2.4s" repeatCount="indefinite"/>` }));
  out.push(`<rect x="${f(x + lw + 10)}" y="${y + 16}" width="${f(lw)}" height="40" rx="4" fill="${T.lamp}" stroke="${T.text}"/>`,
    text(x + lw + 10 + lw / 2, y + 41, "RX", { size: 14, anchor: "middle", weight: 700, extra: ` filter="url(#glow)"`,
      children: `<animate attributeName="opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite"/>` }));
  // Signal meter: five bars, the top ones flickering.
  const by = y + 98, bw = 10;
  out.push(label(x, y + 74, "SIG"));
  for (let i = 0; i < 5; i++) {
    const h = 6 + i * 4, bx = x + 30 + i * (bw + 4);
    out.push(`<rect x="${bx}" y="${by - h}" width="${bw}" height="${h}" fill="${T.text}"${i < 3 ? "" : ` opacity="0.3"`}>` +
      (i < 3 ? "" : `<animate attributeName="opacity" values="0.25;1;0.4;1;0.25" dur="${1.3 + i * 0.4}s" repeatCount="indefinite"/>`) + `</rect>`);
  }
  out.push(text(x + w, by, "S9+20", { size: 12, anchor: "end", fill: T.dim, weight: 700 }));
  // Push-to-talk: the README wraps the image in a mailto: link, so the whole panel is the button.
  if (!tx) {
    out.push(`<rect x="${x}" y="${y + 110}" width="${w}" height="24" rx="4" fill="${T.panel}" stroke="${T.border}"/>`,
      text(x + w / 2, y + 126, "RECEIVE ONLY", { size: 9, anchor: "middle", fill: T.faint, weight: 700, extra: ` letter-spacing="1.5"` }));
    return out.join("\n");
  }
  out.push(`<rect x="${x}" y="${y + 110}" width="${w}" height="24" rx="4" fill="${T.stby}" stroke="${T.amber}">` +
    `<animate attributeName="stroke-opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite"/></rect>`,
    text(x + w / 2, y + 126, "PTT · CLICK TO TRANSMIT", { size: 9, anchor: "middle", fill: T.amber, weight: 700, extra: ` letter-spacing="0.5"` }));
  return out.join("\n");
}

function comms(s, x, y, w, titles) {
  const h = titles ? COMMS_H : COMMS_H - TITLE_H, cy = y + (titles ? 26 : 12);
  const out = [panel(x, y, w, h, titles ? "COMMS · COM 1" : null)];
  if (titles) out.push(text(x + w - 12, y + 16, `MODE ${s.email ? "MAIL" : "RX"} · ${s.frequency} MHz`, { size: 10, anchor: "end", fill: T.dim }));
  out.push(frequency(s, x + 16, cy, 220),
    knob(x + 40, cy + 112, 11, "VOL", 40, 70, 0.3), knob(x + 104, cy + 112, 11, "SQL", -30, -60, 0.4), knob(x + 196, cy + 112, 14, "FREQ", 90, 220, 0.3),
    label(x + 260, cy + 74, "SCOPE"), label(x + 736, cy + 74, "ENC TLS · AUTO-ROUTE", "end"),
    scope(x + 260, cy + 80, 476, 54));
  // The station display and transmitter are a mailto: link too, for when the SVG is opened on its own;
  // in a README the <img> can't follow it, so the README wraps the image in the same link.
  const contact = station(s, x + 260, cy, 476) + "\n" + transmit(x + 756, cy, w - 772, !!s.email);
  const href = s.email && esc(`mailto:${s.email}`);
  out.push(s.email ? `<a href="${href}" xlink:href="${href}" target="_top"><title>Email ${esc(s.email)}</title>\n${contact}\n</a>` : contact);
  return out.join("\n");
}

// Message display: the status line types out on an annunciator, with a GO lamp beside it.
function status(s, x, y, w, titles) {
  const h = titles ? STATUS_H : STATUS_H - TITLE_H, cy = y + (titles ? 26 : 12);
  const out = [panel(x, y, w, h, titles ? "MESSAGE" : null)];
  if (titles) out.push(text(x + w - 12, y + 16, `MSG 1/1 · ${s.statusSource === "github" ? "SYNCED FROM GITHUB" : "PRIORITY ROUTINE"}`, { size: 10, anchor: "end", fill: T.dim }));
  // GO lamp, or amber BUSY when the synced GitHub status is marked busy.
  const busy = !!s.busy;
  out.push(`<rect x="${x + 16}" y="${cy}" width="96" height="40" rx="4" fill="${busy ? T.stby : T.lamp}" stroke="${busy ? T.amber : T.text}"/>`,
    text(x + 64, cy + 16, "STATUS", { size: 9, anchor: "middle", fill: busy ? T.amber : T.dim, weight: 700, extra: ` letter-spacing="1.5"` }),
    text(x + 64, cy + 33, busy ? "BUSY" : "GO", { size: 14, anchor: "middle", weight: 700, fill: busy ? T.amber : T.text, extra: ` filter="url(#glow)" letter-spacing="2"`,
      children: `<animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite"/>` }));

  const pw = s.visitors === undefined ? 72 : 132;
  const dx = x + 124, dw = w - 124 - 16 - pw - 12, msg = s.status.toUpperCase(), n = msg.length;
  const size = Math.max(10, Math.min(16, Math.floor((dw - 32) / (n * (CHAR + 0.125))))), ls = f(size * 0.125), adv = size * CHAR + ls;
  const tx = dx + 14, ty = cy + 20 + size * 0.36, t0 = 1.4;
  out.push(`<rect x="${dx}" y="${cy}" width="${dw}" height="40" rx="4" fill="${T.bg}" stroke="${T.border}"/>`,
    `<clipPath id="msg"><rect x="${tx - 2}" y="${cy + 2}" width="0" height="36"><animate attributeName="width" begin="${t0}s" dur="${f(Math.min(2, n * 0.04))}s" fill="freeze" calcMode="discrete" values="${Array.from({ length: n + 1 }, (_, i) => f(i * adv + 2)).join(";")}"/></rect></clipPath>`,
    `<g clip-path="url(#msg)">${text(tx, ty, msg, { size, weight: 700, extra: ` textLength="${f(n * adv - ls)}" lengthAdjust="spacing" filter="url(#glow)"` })}</g>`,
    `<rect x="${f(tx + n * adv + 2)}" y="${f(ty - size * 0.8)}" width="${f(size * 0.55)}" height="${f(size * 0.95)}" fill="${T.text}" opacity="0">` +
      `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.01;0.5;0.51;1" begin="${f(t0 + Math.min(2, n * 0.04))}s" dur="1s" repeatCount="indefinite"/></rect>`);
  const ax = x + w - 16 - pw;
  if (s.visitors === undefined) {
    // ACK plate.
    out.push(`<rect x="${ax}" y="${cy}" width="${pw}" height="40" rx="4" fill="${T.panel}" stroke="${T.border}"/>`,
      text(ax + pw / 2, cy + 16, "MSG", { size: 9, anchor: "middle", fill: T.faint, extra: ` letter-spacing="1.5"` }),
      text(ax + pw / 2, cy + 32, "ACK", { size: 12, anchor: "middle", fill: T.dim, weight: 700, extra: ` letter-spacing="1.5"` }));
  } else {
    // Visitor log: an odometer of the count when the image was drawn, flashing amber once like the lamp test. Dashes if it couldn't be read.
    const v = s.visitors == null ? "------" : String(s.visitors).padStart(6, "0");
    out.push(`<rect x="${ax}" y="${cy}" width="${pw}" height="40" rx="4" fill="${T.bg}" stroke="${T.border}"/>`,
      text(ax + pw / 2, cy + 14, "VISITOR LOG", { size: 9, anchor: "middle", fill: T.faint, extra: ` letter-spacing="1.5"` }),
      text(ax + pw / 2, cy + 33, v, { size: 16, anchor: "middle", weight: 700, fill: s.visitors == null ? T.faint : T.text,
        extra: ` letter-spacing="2"${s.visitors == null ? "" : ` filter="url(#glow)"`}`,
        children: `<animate attributeName="fill" values="${T.amber};${T.amber};${s.visitors == null ? T.faint : T.text}" keyTimes="0;0.85;1" dur="1.4s" fill="freeze"/>` }));
  }
  return out.join("\n");
}

function annunciators(s, y) {
  const sync = s.generatedAt.slice(0, 16).replace("T", " ") + "Z";
  const lamps = [["COMMS OPEN", true], [`COM1 ${s.frequency}`, false], [`GUARD ${GUARD}`, false], s.email ? ["TX READY", "amber"] : ["RX ONLY", false],
    ["SQUELCH OPEN", false], ["LINK SECURE", false], [`SYNC ${sync}`, false]];
  let x = 16;
  return lamps.map(([l, lit]) => {
    const w = l.length * 6.6 + 18, amber = lit === "amber";
    const g = `<rect x="${f(x)}" y="${y}" width="${f(w)}" height="20" rx="3" fill="${lit === true ? T.lamp : T.panel}" stroke="${lit === true ? T.text : amber ? T.amber : T.border}"/>` +
      text(x + w / 2, y + 14, l, { size: 10, anchor: "middle", fill: lit === true ? T.text : amber ? T.amber : T.dim, weight: lit ? 700 : "",
        children: lit === true ? `<animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite"/>` : "" });
    x += w + 8;
    return g;
  }).join("\n");
}

// titles: false drops the header (title, callsign and name) and the panel titles; the panels move up to fill the space.
// email: false makes the panel receive-only; visitorLog: false swaps the visitor log for the ACK plate.
// part: "comms" draws only the header and comms panel, "status" only the message panel and lamp strip. A README image
// can carry only one link, so the two parts can be stacked with a different link each (mailto: and your project page);
// the corners where they meet are square so they read as one console.
export function buildSvg(profile, { titles = true, email = true, visitorLog = true, part = "all" } = {}) {
  const s = { ...profile, email: email ? profile.email || null : null };
  if (!visitorLog) delete s.visitors;
  const top = part !== "status", stat = part !== "comms", SEAM = 6;
  const ch = titles ? COMMS_H : COMMS_H - TITLE_H, sh = titles ? STATUS_H : STATUS_H - TITLE_H;
  const py = !top ? SEAM : titles ? 56 : 12;
  const sy = top ? py + ch + GAP : py;
  const H = stat ? sy + sh + GAP + 32 : py + ch + SEAM;
  const header = !titles || !top ? "" : [
    text(16, 34, "OPEN COMMS", { size: 18, weight: 700, extra: ` letter-spacing="3"` }),
    text(220, 34, `CALLSIGN ${s.login.toUpperCase()}`, { size: 11, fill: T.amber, extra: ` letter-spacing="1.5"` }),
    `<text x="${W - 16}" y="34" font-size="14" fill="${T.text}" text-anchor="end">${esc(s.name)}</text>`,
    `<line x1="16" y1="46" x2="${W - 16}" y2="46" stroke="${T.border}"/>`,
  ].join("\n");
  const seam = part === "comms" ? `<rect y="${H - 10}" width="${W}" height="10" fill="${T.bg}"/>` : part === "status" ? `<rect width="${W}" height="10" fill="${T.bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
<title>Open Comms Profile Console: ${esc(stat && !top ? s.status : s.email || s.login)}</title>
<defs><filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="${W}" height="${H}" rx="10" fill="${T.bg}"/>${seam}
${header}
${top ? comms(s, 16, py, W - 32, titles) : ""}
${stat ? status(s, 16, sy, W - 32, titles) : ""}
${stat ? annunciators(s, H - 32) : ""}
</svg>`;
}
