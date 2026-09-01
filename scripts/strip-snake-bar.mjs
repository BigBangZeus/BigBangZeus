// Platane/snk renders a "progress" bar under the grid:
//   <rect class="u u0" height="12" width="848.6" x="0" y="144"/>  fill: var(--c4)
// It scales 0 -> 100% over the loop. With a low contribution count it fills
// almost immediately and just sits there as a solid amber slab that dominates
// the image and communicates nothing. Strip it, then crop the viewBox so the
// removal does not leave dead space at the bottom.
//
// Usage: node scripts/strip-snake-bar.mjs dist/a.svg dist/b.svg

import { readFile, writeFile } from "node:fs/promises";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("no files given");
  process.exit(1);
}

for (const f of files) {
  let s = await readFile(f, "utf8");
  const before = s.length;

  const bars = s.match(/<rect class="u u\d+"[^>]*\/>/g) || [];
  if (!bars.length) {
    console.log(`${f}: no progress bar found (snk output changed?) — left as-is`);
    continue;
  }

  // Tallest bar determines how much vertical space we can reclaim.
  const barH = Math.max(
    ...bars.map((b) => parseFloat((b.match(/height="([\d.]+)"/) || [, 0])[1]))
  );
  s = s.replace(/<rect class="u u\d+"[^>]*\/>/g, "");

  const vb = s.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  if (vb) {
    const [x, y, w, h] = vb.slice(1).map(Number);
    // bar height + the gap above it
    const nh = Math.max(1, h - (barH + 20));
    s = s.replace(vb[0], `viewBox="${x} ${y} ${w} ${nh}"`);
    s = s.replace(/(<svg[^>]*?)height="[\d.]+"/, `$1height="${nh}"`);
    console.log(`${f}: removed ${bars.length} bar(s), viewBox h ${h} -> ${nh}`);
  } else {
    console.log(`${f}: removed ${bars.length} bar(s), viewBox not matched`);
  }

  try {
    await writeFile(f, s);
  } catch (err) {
    if (err.code === "EACCES" || err.code === "EPERM") {
      console.error(
        `\n${f}: ${err.code} on write.\n` +
        `Platane/snk is a Docker action and writes dist/ as root; this step runs\n` +
        `as a normal user. Add "sudo chown -R \\"$(id -u):$(id -g)\\" dist" before it.\n`
      );
    }
    throw err;
  }
  console.log(`   ${before} -> ${s.length} bytes`);
}
