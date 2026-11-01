import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const pending = new Map<string, Promise<CachedImage | undefined>>();
interface CachedImage { headers: Record<string, string>; bytes: Uint8Array }
const cacheRoot = () => resolve(process.env.EMDASH_IMAGE_CACHE_DIR || '.cache/image-variants');

/** Disk cache around the native EmDash/Astro transform, versioned by the original. */
export async function cachedImage(request: Request, next: () => Promise<Response>): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return next();
  const url = new URL(request.url);
  if (url.pathname !== '/_image') return next();
  const href = url.searchParams.get('href');
  if (!href) return next();
  let storageKey: string;
  try {
    const source = new URL(href, url);
    const match = source.pathname.match(/^\/_emdash\/api\/media\/file\/([A-Za-z0-9_.-]+)$/);
    if (!match || match[1] === '.' || match[1] === '..') return next();
    storageKey = match[1];
  } catch { return next(); }
  let version: string;
  try {
    const source = await stat(join(resolve(process.env.EMDASH_UPLOADS_DIR || 'uploads'), storageKey));
    if (!source.isFile()) return next();
    version = `${source.size}:${source.mtimeMs}:${source.ctimeMs}`;
  } catch { return next(); }
  const params = new URLSearchParams(url.searchParams);
  // Different public hosts still address the same locally stored original.
  params.set('href', storageKey);
  params.sort();
  const key = createHash('sha256').update(`webp-v1:${version}:${params}`).digest('hex');
  const directory = cacheRoot();
  const metadataPath = join(directory, `${key}.json`);
  const bodyPath = join(directory, `${key}.bin`);
  async function read(): Promise<CachedImage | undefined> {
    try {
      const [metadata, bytes] = await Promise.all([readFile(metadataPath, 'utf8'), readFile(bodyPath)]);
      return { headers: JSON.parse(metadata), bytes };
    } catch { return undefined; }
  }
  function response(image: CachedImage, status: string): Response {
    const headers = new Headers(image.headers);
    headers.set('X-Image-Cache', status);
    if (headers.get('ETag') && request.headers.get('If-None-Match')?.split(',').map(t=>t.trim()).some(tag=>tag === '*' || tag === headers.get('ETag'))) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : image.bytes as BodyInit, { status: 200, headers });
  }
  const hit = await read();
  if (hit) return response(hit, 'HIT');
  const filling = pending.get(key);
  if (filling) {
    const image = await filling;
    if (image) return response(image, 'HIT');
    return next();
  }
  let original: Response | undefined;
  const fill = (async () => {
    original = await next();
    if (request.method === 'HEAD' || original.status !== 200 || !original.headers.get('Content-Type')?.startsWith('image/')) return undefined;
    const bytes = new Uint8Array(await original.arrayBuffer());
    const image = { bytes, headers: Object.fromEntries(original.headers) };
    const suffix = `.${randomUUID()}.tmp`;
    try {
      await mkdir(directory, { recursive: true });
      await Promise.all([writeFile(bodyPath + suffix, bytes), writeFile(metadataPath + suffix, JSON.stringify(image.headers))]);
      await rename(bodyPath + suffix, bodyPath);
      await rename(metadataPath + suffix, metadataPath);
    } catch (error) { console.warn('[image-cache] Cache write unavailable:', error instanceof Error ? error.message : String(error)); }
    return image;
  })();
  pending.set(key, fill);
  try {
    const image = await fill;
    return image ? response(image, 'MISS') : original!;
  } finally { pending.delete(key); }
}
