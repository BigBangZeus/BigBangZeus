// Generates the amber CRT stat cards from the GitHub API.
// No third-party card services — those all died. This owns the whole pipeline.
// Run: node scripts/gen-cards.mjs   (needs GH_TOKEN + GH_USER in env)

import { writeFile, mkdir } from "node:fs/promises";

const USER  = process.env.GH_USER  || "BigBangZeus";
const TOKEN = process.env.GH_TOKEN;
const OUT   = "assets/cache";

const C = {
  bg:    "#0d0900",
  panel: "#140c00",
  dim:   "#8a5f00",
  mid:   "#c98a00",
  amber: "#ffb000",
  hi:    "#ffd166",
  lock:  "#5c3f00",
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
           .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "bigbangzeus-profile",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// ── shared chrome ────────────────────────────────────────────────────────────
const defs = (h) => `
  <defs>
    <filter id="g" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="sl" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="1.5" fill="#000" opacity="0.28"/>
    </pattern>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="58%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.65"/>
    </radialGradient>
    <clipPath id="cp"><rect x="8" y="8" width="984" height="${h - 16}" rx="10"/></clipPath>
  </defs>`;

const style = `
  <style>
    text { font-family: "Courier New", Courier, "DejaVu Sans Mono", monospace; }
    .row { opacity: 0; animation: fin 7s ease-out infinite; }
    @keyframes fin {
      0%,5% { opacity: 0; transform: translateX(-5px); }
      12%,93% { opacity: 1; transform: translateX(0); }
      100% { opacity: 0; transform: translateX(-5px); }
    }
    .bar { transform: scaleX(0); transform-box: fill-box; transform-origin: left center;
           animation: grow 7s cubic-bezier(.2,.8,.3,1) infinite; }
    @keyframes grow { 0%,14% { transform: scaleX(0); } 34%,93% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
    .scan { animation: drift 1.1s linear infinite; }
    @keyframes drift { to { transform: translateY(3px); } }
    .cur { animation: blink 1.06s steps(1) infinite; }
    @keyframes blink { 0%,50%{opacity:1} 50.01%,100%{opacity:0} }
    .tube { animation: fl 4.1s ease-in-out infinite; }
    @keyframes fl { 0%,100%{opacity:1} 40%{opacity:.96} 42%{opacity:1} 74%{opacity:.94} 76%{opacity:1} }
  </style>`;

const frame = (h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${h}" width="1000" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>${defs(h)}${style}
<g class="tube">
  <rect width="1000" height="${h}" rx="12" fill="${C.bg}"/>
  <rect x="8" y="8" width="984" height="${h - 16}" rx="10" fill="${C.panel}" stroke="${C.amber}" stroke-opacity="0.34"/>
  <g clip-path="url(#cp)">
    <rect x="8" y="8" width="984" height="30" fill="#1c1000"/>
    <line x1="8" y1="38" x2="992" y2="38" stroke="${C.amber}" stroke-opacity="0.22"/>
    <circle cx="30" cy="23" r="4.5" fill="${C.amber}" fill-opacity="0.85"/>
    <circle cx="48" cy="23" r="4.5" fill="${C.amber}" fill-opacity="0.5"/>
    <circle cx="66" cy="23" r="4.5" fill="${C.amber}" fill-opacity="0.28"/>
    <text x="500" y="27" font-size="12" fill="${C.mid}" text-anchor="middle" letter-spacing="1.6">${esc(title)}</text>
${body}
    <rect class="scan" x="8" y="-4" width="984" height="${h + 8}" fill="url(#sl)"/>
    <rect x="8" y="8" width="984" height="${h - 16}" rx="10" fill="url(#vig)"/>
  </g>
</g>
</svg>`;

// ── card 1: system monitor ───────────────────────────────────────────────────
function statsCard(d) {
  const rows = [
    ["uptime",     d.uptime],
    ["repos",      d.repos],
    ["stars",      d.stars],
    ["forks",      d.forks],
    ["followers",  d.followers],
    ["following",  d.following],
    ["languages",  d.langCount],
    ["since",      d.since],
  ];
  const left = rows.map(([k, v], i) => `
    <g class="row" style="animation-delay:${(0.1 + i * 0.09).toFixed(2)}s">
      <text x="34" y="${72 + i * 26}" font-size="14.5" fill="${C.mid}">${esc(k)}</text>
      <text x="176" y="${72 + i * 26}" font-size="14.5" fill="${C.amber}">${esc(v)}</text>
    </g>`).join("");

  const total = d.langs.reduce((a, l) => a + l.bytes, 0) || 1;
  const bars = d.langs.slice(0, 6).map((l, i) => {
    const pct = (l.bytes / total) * 100;
    const w = Math.max(3, Math.round((pct / 100) * 300));
    return `
    <g class="row" style="animation-delay:${(0.5 + i * 0.11).toFixed(2)}s">
      <text x="470" y="${72 + i * 30}" font-size="13.5" fill="${C.mid}">${esc(l.name)}</text>
      <rect x="596" y="${60 + i * 30}" width="300" height="11" rx="5.5" fill="#000" fill-opacity="0.5" stroke="${C.amber}" stroke-opacity="0.25"/>
      <rect class="bar" style="animation-delay:${(0.5 + i * 0.11).toFixed(2)}s" x="598" y="${62 + i * 30}" width="${w}" height="7" rx="3.5" fill="${C.amber}"/>
      <text x="964" y="${72 + i * 30}" font-size="12" fill="${C.hi}" text-anchor="end">${pct.toFixed(1)}%</text>
    </g>`;
  }).join("");

  return frame(300, `system_monitor — ${USER}`, `
    <text class="row" x="34" y="52" font-size="12" fill="${C.dim}" letter-spacing="2.6">ACCOUNT</text>
    <text class="row" x="470" y="52" font-size="12" fill="${C.dim}" letter-spacing="2.6">LANGUAGE DISTRIBUTION</text>
    ${left}${bars}
    <rect class="cur" x="34" y="272" width="9" height="14" fill="${C.hi}"/>
    <text x="52" y="284" font-size="12" fill="${C.dim}">refreshed daily via github actions</text>`);
}

// ── card 2: unlock progression ───────────────────────────────────────────────
// Checkboxes stay ASCII "[x]"/"[ ]" on purpose — U+2713 font-substitutes to a
// radical sign in Courier New, which is the font the SVG renders with.
function achievementsCard(d) {
  const M = [
    ["FIRST_CONTACT",  "publish a repository",       d.repos,      1],
    ["SHIPPER",        "publish 3 repositories",     d.repos,      3],
    ["POLYGLOT",       "ship in 2+ languages",       d.langCount,  2],
    ["VETERAN",        "1 year on platform",         d.years,      1],
    ["STARGAZER",      "earn your first star",       d.stars,      1],
    ["CONSTELLATION",  "earn 10 stars",              d.stars,     10],
    ["NETWORKED",      "reach 10 followers",         d.followers, 10],
    ["CENTURION",      "publish 10 repositories",    d.repos,     10],
  ];

  const body = M.map(([name, desc, cur, target], i) => {
    const done = cur >= target;
    const pct  = Math.min(1, cur / target);
    const col  = i % 2, r = Math.floor(i / 2);
    const x = 34 + col * 476, y = 74 + r * 62;
    const w = Math.max(2, Math.round(pct * 300));
    return `
    <g class="row" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">
      <text x="${x}" y="${y}" font-size="14" fill="${done ? C.hi : C.lock}">${done ? "[x]" : "[ ]"}</text>
      <text x="${x + 34}" y="${y}" font-size="14" fill="${done ? C.amber : C.lock}" letter-spacing="1.2">${esc(name)}</text>
      <text x="${x + 34}" y="${y + 17}" font-size="11.5" fill="${done ? C.dim : C.lock}">${esc(desc)}</text>
      <rect x="${x + 34}" y="${y + 25}" width="300" height="7" rx="3.5" fill="#000" fill-opacity="0.5" stroke="${C.amber}" stroke-opacity="0.2"/>
      <rect class="bar" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s" x="${x + 35}" y="${y + 26}" width="${w}" height="5" rx="2.5" fill="${done ? C.amber : C.lock}"/>
      <text x="${x + 400}" y="${y + 32}" font-size="11" fill="${done ? C.hi : C.lock}" text-anchor="end">${Math.min(cur, target)}/${target}</text>
    </g>`;
  }).join("");

  const unlocked = M.filter(([, , c, t]) => c >= t).length;
  return frame(340, `achievements — ${unlocked}/${M.length} unlocked`, `
    <text class="row" x="34" y="56" font-size="12" fill="${C.dim}" letter-spacing="2.6">MILESTONES</text>
    ${body}
    <rect class="cur" x="34" y="312" width="9" height="14" fill="${C.hi}"/>
    <text x="52" y="324" font-size="12" fill="${C.dim}">${unlocked} unlocked · ${M.length - unlocked} remaining</text>`);
}

// ── main ─────────────────────────────────────────────────────────────────────
const user  = await gh(`/users/${USER}`);
const repos = await gh(`/users/${USER}/repos?per_page=100&type=owner`);

const langTotals = {};
for (const r of repos) {
  if (r.fork) continue;
  const langs = await gh(`/repos/${USER}/${r.name}/languages`);
  for (const [k, v] of Object.entries(langs)) langTotals[k] = (langTotals[k] || 0) + v;
}

const created = new Date(user.created_at);
const now     = new Date();
const months  = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());

const data = {
  repos:     user.public_repos,
  followers: user.followers,
  following: user.following,
  stars:     repos.reduce((a, r) => a + r.stargazers_count, 0),
  forks:     repos.reduce((a, r) => a + r.forks_count, 0),
  langs:     Object.entries(langTotals).map(([name, bytes]) => ({ name, bytes }))
                   .sort((a, b) => b.bytes - a.bytes),
  since:     created.toISOString().slice(0, 10),
  years:     Math.floor(months / 12),
  uptime:    `${Math.floor(months / 12)}y ${months % 12}m`,
};
data.langCount = data.langs.length;

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/stats.svg`,        statsCard(data));
await writeFile(`${OUT}/achievements.svg`, achievementsCard(data));

console.log("generated:", JSON.stringify({ ...data, langs: data.langs.map(l => l.name) }, null, 2));
