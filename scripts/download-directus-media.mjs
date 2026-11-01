import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
const snapshot = JSON.parse(await readFile('.migration/directus.json', 'utf8'));
const files = snapshot.files.filter(file => file.type?.startsWith('image/'));
await mkdir('.migration/media', { recursive: true });
const manifest = [];
let next = 0;
async function worker() {
  while (next < files.length) {
    const file = files[next++];
    const extension = extname(file.filename_download || '') || ({ 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' }[file.type]);
    const path = `.migration/media/${file.id}${extension}`;
    let bytes;
    try { if ((await stat(path)).size) bytes = await readFile(path); } catch { /* Not downloaded. */ }
    if (!bytes) {
      let error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`https://admin.vieille-europe.ch/assets/${file.id}`, { signal: AbortSignal.timeout(60000) });
          if (!response.ok) throw new Error(`${file.id}: HTTP ${response.status}`);
          bytes = Buffer.from(await response.arrayBuffer());
          if (!bytes.length) throw new Error(`${file.id}: empty image`);
          await writeFile(path, bytes);
          break;
        } catch (cause) { error = cause; }
      }
      if (!bytes) throw error;
    }
    manifest.push({ ...file, path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (manifest.length % 50 === 0) console.log(`${manifest.length}/${files.length} originals downloaded`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
manifest.sort((a,b) => a.id.localeCompare(b.id));
await writeFile('.migration/media-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ files: manifest.length, bytes: manifest.reduce((n,f)=>n+f.size,0), largest: Math.max(...manifest.map(f=>f.size)) }));
