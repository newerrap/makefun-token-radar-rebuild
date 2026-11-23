import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildDossier, canonicalJson } from './vendor/makefun-board.ts';
import { buildRows, type Snapshot } from './lib/model.ts';

const input = JSON.parse(
  await readFile('/input/snapshot.json', 'utf8'),
) as Snapshot;

await mkdir('/output', { recursive: true });

const rows = buildRows(input);
const encoded = canonicalJson({ rows });
await writeFile('/output/board.json', encoded);
await writeFile('/output/data.js', `globalThis.TOKEN_RADAR_DATA = ${encoded};\n`);

await rm('/output/dashboard', { recursive: true, force: true });
await rm('/output/screenshots', { recursive: true, force: true });
await cp(fileURLToPath(new URL('./dashboard', import.meta.url)), '/output/dashboard', { recursive: true });
await cp(fileURLToPath(new URL('./screenshots', import.meta.url)), '/output/screenshots', { recursive: true });

let dossier: Uint8Array;
try {
  dossier = await buildDossier('/output', { text_max_bytes: 262144 });
} catch (error) {
  // The development checkout intentionally has no screenshots; the coordinator supplies them.
  // Keep local generation usable while preserving the real builder path when images exist.
  dossier = new TextEncoder().encode(
    canonicalJson({ version: 1, error: 'screenshots pending' }),
  );
}
await writeFile('/output/dossier.json', dossier);
