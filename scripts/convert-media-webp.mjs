import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
let source;
try { source = JSON.parse(await readFile('.migration/media-originals.json', 'utf8')); }
catch { source = JSON.parse(await readFile('.migration/media-manifest.json', 'utf8')); await writeFile('.migration/media-originals.json', JSON.stringify(source, null, 2)); }
await mkdir('.migration/webp', { recursive: true });
const output = [];
let next = 0;
async function worker() {
  while (next < source.length) {
    const original = source[next++];
    let file = { ...original };
    if (original.type !== 'image/svg+xml') {
      const path = `.migration/webp/${original.id}.webp`;
      const { data, info } = await sharp(await readFile(original.path)).rotate().webp({ quality: 80, effort: 6 }).toBuffer({ resolveWithObject: true });
      await writeFile(path, data);
      file = { ...file, path, width: info.width, height: info.height, type: 'image/webp', filename_download: `${original.filename_download.replace(/\.[^.]+$/, '')}.webp`, size: data.length, sha1: createHash('sha1').update(data).digest('hex'), sha256: createHash('sha256').update(data).digest('hex'), originalSize: original.size, originalSha256: original.sha256 };
    }
    output.push(file);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
output.sort((a,b)=>a.id.localeCompare(b.id));
await writeFile('.migration/media-manifest.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify({ images: output.length, originalBytes: source.reduce((n,f)=>n+f.size,0), webpBytes: output.reduce((n,f)=>n+f.size,0), largest: Math.max(...output.map(f=>f.size)) }));
