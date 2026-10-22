// Live VISITOR LOG strip in the Open Comms Profile Console palette, drawn fresh on every view by the Cloudflare Worker in worker/.
// It's meant to sit between the comms and status parts (?part=comms / ?part=status), so its corners are square.

const W = 960, H = 48, CELLS = 7;
const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const T = {
  bg: "#020d07", panel: "#03140b", border: "#14522d", grid: "#0f3d22",
  text: "#5dff95", dim: "#2fc062", faint: "#1c8443", lamp: "#0b3a1f", amber: "#ffb347",
};

const digits = (n) => String(Math.max(0, n)).padStart(CELLS, "0").slice(-CELLS);

// count: the visit count including this view, or null when it can't be read (dashes). now: a Date for LAST CONTACT.
export function buildStrip(count, now = new Date()) {
  const ok = Number.isInteger(count);
  const b = 10, c = (px, py, dx, dy) => `M${px + dx * b},${py}L${px},${py}L${px},${py + dy * b}`;
  const out = [
    `<rect width="${W}" height="${H}" fill="${T.bg}"/>`,
    `<rect x="16" y="6" width="928" height="36" rx="6" fill="${T.panel}" stroke="${T.border}"/>`,
    `<path d="${c(16, 6, 1, 1)}${c(944, 6, -1, 1)}${c(16, 42, 1, -1)}${c(944, 42, -1, -1)}" fill="none" stroke="${T.dim}" stroke-width="1.5"/>`,
    // LIVE lamp: this strip is drawn for this view.
    `<rect x="28" y="12" width="56" height="24" rx="3" fill="${T.lamp}" stroke="${T.text}"/>`,
    `<text x="56" y="28" font-size="11" fill="${T.text}" text-anchor="middle" font-weight="700" letter-spacing="1.5" filter="url(#glow)">LIVE` +
      `<animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite"/></text>`,
    `<text x="100" y="29" font-size="12" fill="${T.dim}" font-weight="700" letter-spacing="2.5">VISITOR LOG</text>`,
  ];

  // Odometer: one cell per digit. Digits that changed with this visit roll up from the previous count.
  const x0 = 260, cw = 24, gap = 4, now7 = ok ? digits(count) : "-".repeat(CELLS), was7 = ok ? digits(count - 1) : now7;
  for (let i = 0; i < CELLS; i++) {
    const x = x0 + i * (cw + gap), cx = x + cw / 2;
    out.push(`<clipPath id="cell${i}"><rect x="${x}" y="11" width="${cw}" height="26" rx="3"/></clipPath>`,
      `<rect x="${x}" y="11" width="${cw}" height="26" rx="3" fill="${T.bg}" stroke="${T.border}"/>`);
    const glyph = (d, y) => `<text x="${cx}" y="${y}" font-size="18" fill="${ok ? T.text : T.faint}" text-anchor="middle" font-weight="700"${ok ? ` filter="url(#glow)"` : ""}>${d}</text>`;
    if (was7[i] === now7[i]) out.push(glyph(now7[i], 31));
    else out.push(`<g clip-path="url(#cell${i})"><g>${glyph(was7[i], 31)}${glyph(now7[i], 57)}` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -26" keyTimes="0;0.4;1" dur="1s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.3 0 0.2 1"/></g></g>`);
  }
  // A short amber flash on the cells when the count steps, like the lamp test on the other panels.
  if (ok) out.push(`<rect x="${x0 - 3}" y="8" width="${CELLS * (cw + gap) + 2}" height="32" rx="5" fill="none" stroke="${T.amber}" opacity="0">` +
    `<animate attributeName="opacity" values="0;0;0.9;0" keyTimes="0;0.4;0.6;1" dur="1.4s" fill="freeze"/></rect>`);

  out.push(`<text x="${x0 + CELLS * (cw + gap) + 12}" y="29" font-size="10" fill="${T.faint}" letter-spacing="1.5">${ok ? "COUNTED ON EVERY VIEW" : "COUNTER OFFLINE"}</text>`,
    `<text x="928" y="29" font-size="10" fill="${T.dim}" text-anchor="end" letter-spacing="1">LAST CONTACT ${now.toISOString().slice(11, 16)}Z</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
<title>Visitor log: ${ok ? count : "offline"}</title>
<defs><filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
${out.join("\n")}
</svg>`;
}
