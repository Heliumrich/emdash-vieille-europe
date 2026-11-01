import { stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// A replaced original keeps its EmDash URL. Version the build input so Astro
// produces a new immutable filename instead of reusing a cached browser URL.
export async function versionedMediaUrl(source, origin, directory = process.env.EMDASH_UPLOADS_DIR || 'uploads') {
  const url = new URL(source, origin);
  const match = url.pathname.match(/^\/_emdash\/api\/media\/file\/([A-Za-z0-9_.-]+)$/);
  if (!match || ['.', '..'].includes(match[1])) return url.href;
  const file = await stat(join(resolve(directory), match[1]));
  const version = createHash('sha256').update(`${file.size}:${file.mtimeMs}:${file.ctimeMs}`).digest('hex').slice(0, 20);
  url.searchParams.set('v', version);
  return url.href;
}
