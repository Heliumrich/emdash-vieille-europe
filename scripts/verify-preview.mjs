// Mutates and restores only the local fixture. Never accepts a remote origin.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { EmDashClient, createTransport, csrfInterceptor, devBypassInterceptor } from 'emdash/client';
const admin = process.env.TEST_ADMIN_ORIGIN || 'http://127.0.0.1:4383';
const runtime = process.env.TEST_PUBLIC_ORIGIN || 'http://127.0.0.1:4385';
for (const origin of [admin, runtime]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local fixture only');
if (process.argv.includes('--read-only')) {
  process.env.EMDASH_SITE_URL = runtime;
  await import('./verify-site.mjs');
  const counter = await fetch(`${runtime}/api/statistiques/count/`);
  assert.equal(counter.status, 200);
  assert.ok(Number.isSafeInteger((await counter.json()).total));
  const statistics = await fetch(`${runtime}/statistiques/`);
  assert.equal(statistics.status, 200);
  assert.ok(statistics.headers.get('Cache-Control')?.includes('no-store'));
  const search = await fetch(`${runtime}/search/?q=tinplate`);
  assert.equal(search.status, 200);
  assert.ok((await search.text()).includes('/blog/'));
  console.log(JSON.stringify({ counter: '200 JSON', statistics: '200 no-store', search: '200 with results' }));
  process.exit(0);
}
const client = new EmDashClient({ baseUrl: admin, devBypass: true });
const transport = createTransport({ interceptors: [csrfInterceptor(), devBypassInterceptor(admin)] });
const slug = 'la-magie-du-tinplate-0-de-style-suisse';
const original = await client.get('posts', slug, { raw: true });
assert.ok(!original.draftRevisionId, 'Fixture already has a draft; refusing to overwrite it');
const marker = `LOCAL_PREVIEW_ONLY_${Date.now()}`;
const draft = structuredClone(original.data);
draft.content.push({ _type: 'block', _key: `test-${Date.now()}`, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `text-${Date.now()}`, text: marker, marks: [] }] });
async function api(path, body) {
  const response = await transport.fetch(new Request(`${admin}/_emdash/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  assert.ok(response.ok, `API ${path}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return response.json();
}
function runtimeUrl(path) {
  const url = new URL(path, admin);
  return new URL(url.pathname + url.search, runtime);
}
let changed = false;
const queue = process.env.TEST_QUEUE_DIR || '.cache/automation-test/queue';
const before = new Set(await readdir(queue).catch(error => { if (error.code === 'ENOENT') return []; throw error; }));
try {
  await client.update('posts', original.id, { _rev: original._rev, data: draft });
  changed = true;
  const preview = await api(`/content/posts/${original.id}/preview-url`, {});
  assert.ok(preview.data.url.includes('/preview/posts/'), 'Native preview path override missing');
  const response = await fetch(runtimeUrl(preview.data.url));
  const body = await response.text();
  assert.equal(response.status, 200, `Preview ${runtimeUrl(preview.data.url).pathname}: ${body.slice(0, 160)}`);
  assert.ok(body.includes(marker), 'Signed SSR preview did not return the draft');
  assert.ok(response.headers.get('Cache-Control')?.includes('no-store'));
  assert.ok(response.headers.get('X-Robots-Tag')?.includes('noindex'));
  const publicPage = await fetch(`${runtime}/blog/${slug}/`);
  assert.equal(publicPage.status, 200);
  assert.ok(!(await publicPage.text()).includes(marker), 'Draft leaked to static HTML');
  assert.equal((await fetch(`${runtime}/preview/posts/${slug}/`)).status, 404);
  const mismatch = runtimeUrl(preview.data.url);
  mismatch.pathname = '/preview/pages/presentation/';
  assert.equal((await fetch(mismatch)).status, 404, 'Token must be scoped to its entry');
  const current = await client.get('posts', original.id, { raw: true });
  await api(`/content/posts/${original.id}/publish`, { _rev: current._rev });
  let signals = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    signals = (await readdir(queue)).filter(name => name.endsWith('.json') && !before.has(name));
    if (signals.length) break;
    await new Promise(accept => setTimeout(accept, 100));
  }
  assert.ok(signals.length > 0, 'Publication did not queue a rebuild');
  const cssHtml = await (await fetch(runtime)).text();
  const css = [...cssHtml.matchAll(/<link[^>]+href="([^"\s]+\.css)"/g)].map(match=>match[1]);
  assert.ok(css.length);
  for (const path of css) {
    const stylesheet = await fetch(new URL(path, runtime));
    assert.equal(stylesheet.status, 200);
    assert.ok(stylesheet.headers.get('Content-Type')?.includes('text/css'));
    assert.ok(!(await stylesheet.text()).startsWith('<!DOCTYPE'));
  }
  console.log(JSON.stringify({ signedDraftPreview: true, staticDraftLeak: false, unsignedAndMismatchedTokens: '404', nativePublicationSignal: true, css: '200 text/css' }));
} finally {
  if (changed) {
    const current = await client.get('posts', original.id, { raw: true });
    const restored = await client.update('posts', original.id, { _rev: current._rev, data: original.data });
    await api(`/content/posts/${original.id}/publish`, { _rev: restored._rev, publishedAt: original.publishedAt });
  }
}
