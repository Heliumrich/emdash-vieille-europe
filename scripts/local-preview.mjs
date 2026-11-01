// Local fixture only: import the prepared content through supported EmDash APIs.
import { readFile, writeFile } from 'node:fs/promises';
import { EmDashClient, createTransport, csrfInterceptor, devBypassInterceptor } from 'emdash/client';
import { spawnSync } from 'node:child_process';
const base = process.env.EMDASH_SITE_URL || 'http://127.0.0.1:4322';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This fixture is restricted to localhost.');
const client = new EmDashClient({ baseUrl: base, devBypass: true });
const transport = createTransport({ interceptors: [csrfInterceptor(), devBypassInterceptor(base)] });
const manifest = JSON.parse(await readFile('.migration/media-manifest.json', 'utf8'));
let media = {};
try { media = JSON.parse(await readFile('.migration/local-media-map.json', 'utf8')); } catch { /* Initial import. */ }
for (const file of manifest) {
  if (media[file.id]) continue;
  const uploaded = await client.mediaUpload(await readFile(file.path), `directus-${file.id}-${file.filename_download}`, { contentType: file.type });
  media[file.id] = { ...uploaded, url: `/_emdash/api/media/file/${uploaded.storageKey}` };
  await writeFile('.migration/local-media-map.json', JSON.stringify(media));
}
const result = spawnSync(process.execPath, ['scripts/rewrite-media.mjs'], { encoding: 'utf8', env: { ...process.env, EMDASH_MEDIA_MAP_PATH: '.migration/local-media-map.json', EMDASH_ENTRIES_OUTPUT: '.migration/entries-local.json' } });
if (result.status !== 0) throw new Error(result.stderr);
const entries = JSON.parse(await readFile('.migration/entries-local.json', 'utf8'));
for (const entry of entries) {
  const current = await client.get(entry.collection, entry.slug, { raw: true });
  const updated = await client.update(entry.collection, current.id, { _rev: current._rev, data: entry.data });
  const response = await transport.fetch(new Request(`${base}/_emdash/api/content/${entry.collection}/${current.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _rev: updated._rev, publishedAt: entry.publishedAt }) }));
  if (!response.ok) throw new Error(`${entry.slug}: ${response.status} ${await response.text()}`);
}
console.log(JSON.stringify({ localEntries: entries.length, localMedia: Object.keys(media).length }));
