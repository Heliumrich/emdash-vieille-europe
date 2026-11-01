import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function publicationDirectory() {
  return resolve(process.env.VE_PUBLISH_DIR || '.site');
}
export async function requestPublication(reason, options = {}) {
  if (!options.force && process.env.VE_AUTO_PUBLISH !== '1') return;
  const directory = join(options.directory || publicationDirectory(), 'queue');
  await mkdir(directory, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}`;
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, JSON.stringify({ reason, requestedAt: new Date().toISOString() }), { flag: 'wx' });
  await rename(temporary, join(directory, `${name}.json`));
}
