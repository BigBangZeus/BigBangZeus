// Generates assets/dotfield.svg — a purely DECORATIVE animated amber dot matrix.
//
// This is ornament, not data. It deliberately does not represent contributions,
// commits, or any other metric. It replaced the contribution snake in the README
// because the snake honestly showed 7 active days and looked sparse; this gives
// the dense golden motion without pretending to be a statistic.
//
// Output is static — generate once, commit it. No workflow, no API, nothing to
// rate-limit or break.
//
// Run: node scripts/gen-dotfield.mjs

import { writeFile, mkdir } from "node:fs/promises";

// 25 x 4 = 100 dots. Fewer dots in the same width means each one has to be
// bigger, or the panel reads as sparse rather than deliberate — so the dot
// grew 11 -> 24px and the grid is centred with generous gaps.
const COLS = 25;
const ROWS = 4;
const D = 24;            // dot size
const CW = 36.8, CH = 37;
const W = 1000, H = 200;
// centre the grid in the panel
const X0 = (W - ((COLS - 1) * CW + D)) / 2;
const Y0 = (H - ((ROWS - 1) * CH + D)) / 2;
const DUR = 4.6;         // master wave period (s)

// Deterministic PRNG so regenerating yields an identical file (no git churn).
let seed = 0x9e3779b9;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

const r2 = (n) => Math.round(n * 100) / 100;

const dots = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x = r2(X0 + col * CW);
    const y = r2(Y0 + row * CH);

    // Diagonal traveling wave. Negative delay starts each dot mid-cycle so the
    // field is already in motion at t=0 rather than igniting from a flat state.
    // Coarser grid needs a bigger per-column step or the wave is imperceptible.
    const phase = col * 0.12 + row * 0.22 + rnd() * 0.16;
    const delay = r2(-(phase % DUR));

    // Peak brightness tier. Weighted so most dots stay mid-amber and only a
    // few reach the hottest tone — a uniform field reads as flat.
    const t = rnd();
    const tier = t > 0.93 ? 3 : t > 0.72 ? 2 : t > 0.34 ? 1 : 0;

    // ~5% twinkle on a coprime period so flares never sync with the wave.
    const twinkle = rnd() > 0.95;

    dots.push(
      `<rect class="d t${tier}${twinkle ? " k" : ""}" x="${x}" y="${y}" ` +
      `width="${D}" height="${D}" rx="6" style="animation-delay:${delay}s"/>`
    );
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Decorative animated amber dot field">
<title>decorative dot field</title>
<defs>
  <pattern id="sl" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="1.5" fill="#000" opacity="0.26"/>
  </pattern>
  <radialGradient id="vig" cx="50%" cy="50%" r="76%">
    <stop offset="56%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
  </radialGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#ffd166" stop-opacity="0"/>
    <stop offset="50%"  stop-color="#ffe9b0" stop-opacity="0.10"/>
    <stop offset="100%" stop-color="#ffd166" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="cp"><rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="10"/></clipPath>
</defs>
<style>
  .d { fill: #3d2600; animation: pulse ${DUR}s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { fill: #33200a; }
    46%      { fill: #6b4200; }
    54%      { fill: #6b4200; }
  }
  .t1 { animation-name: p1; }
  .t2 { animation-name: p2; }
  .t3 { animation-name: p3; }
  @keyframes p1 { 0%,100% { fill:#33200a; } 50% { fill:#c98a00; } }
  @keyframes p2 { 0%,100% { fill:#3d2600; } 50% { fill:#ffb000; } }
  @keyframes p3 { 0%,100% { fill:#452b00; } 50% { fill:#ffd166; } }

  /* Twinkle rides on top of the wave via a second, coprime-period animation. */
  .k { animation-duration: ${DUR}s, 7.3s; animation-name: p3, flare;
       animation-timing-function: ease-in-out, ease-in-out;
       animation-iteration-count: infinite, infinite; }
  @keyframes flare { 0%,88%,100% { opacity: 1; } 94% { opacity: 0.25; } }

  .sweep { animation: sw 6.2s linear infinite; }
  @keyframes sw { 0% { transform: translateX(-320px); } 100% { transform: translateX(${W}px); } }

  .scan { animation: drift 1.1s linear infinite; }
  @keyframes drift { to { transform: translateY(3px); } }

  .tube { animation: fl 4.9s ease-in-out infinite; }
  @keyframes fl { 0%,100%{opacity:1} 44%{opacity:.965} 46%{opacity:1} 78%{opacity:.945} 80%{opacity:1} }
</style>
<g class="tube">
  <rect width="${W}" height="${H}" rx="12" fill="#0d0900"/>
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="10" fill="#140c00" stroke="#ffb000" stroke-opacity="0.30"/>
  <g clip-path="url(#cp)">
    ${dots.join("\n    ")}
    <g class="sweep"><rect x="0" y="8" width="320" height="${H - 16}" fill="url(#sweep)"/></g>
    <rect class="scan" x="8" y="-4" width="${W - 16}" height="${H + 8}" fill="url(#sl)"/>
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="10" fill="url(#vig)"/>
  </g>
</g>
</svg>
`;

await mkdir("assets", { recursive: true });
await writeFile("assets/dotfield.svg", svg);
console.log(`assets/dotfield.svg  ${dots.length} dots, ${svg.length} bytes`);
