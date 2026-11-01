import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { publishStatic, validateStatic, mergeImmutableAssets } from './publisher.mjs';
import { requestPublication } from '../plugins/static-publisher/queue.js';
import { createPlugin } from '../plugins/static-publisher/index.js';
import { versionedMediaUrl } from '../src/lib/media-version.mjs';

async function fixture(output, label = 'old') {
  const client = join(output, 'client');
  await mkdir(join(client, '_astro'), { recursive: true });
  await mkdir(join(client, 'presentation'), { recursive: true });
  await writeFile(join(client, '_astro', `${label}.css`), 'body { color: green }');
  const html = `<html><head><link rel="stylesheet" href="/_astro/${label}.css"></head><body>${label}</body></html>`;
  await writeFile(join(client, 'index.html'), html);
  await writeFile(join(client, 'presentation/index.html'), html);
  return client;
}
async function sandbox(fn) {
  const root = await mkdtemp(join(tmpdir(), 've-publisher-'));
  try { await fn(root); }
  finally { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); }
}
test('native publication hook writes a durable event; draft saves have no publication hook', () => sandbox(async directory => {
  const previous = { auto: process.env.VE_AUTO_PUBLISH, directory: process.env.VE_PUBLISH_DIR };
  process.env.VE_AUTO_PUBLISH = '1'; process.env.VE_PUBLISH_DIR = directory;
  try {
    const plugin = createPlugin();
    assert.equal(plugin.hooks['content:afterSave'], undefined);
    await plugin.hooks['content:afterPublish'].handler({}, {});
    const files = await readdir(join(directory, 'queue'));
    assert.equal(files.length, 1);
    assert.equal(JSON.parse(await readFile(join(directory, 'queue', files[0]), 'utf8')).reason, 'published');
  } finally {
    for (const [key, value] of [['VE_AUTO_PUBLISH', previous.auto], ['VE_PUBLISH_DIR', previous.directory]]) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}));
test('failed build leaves the current site and queue intact, without a stuck lock', () => sandbox(async directory => {
  await requestPublication('first', { directory, force: true });
  const first = await publishStatic({ directory, force: true, build: async (_, output) => fixture(output) });
  assert.equal(first.status, 'published');
  const old = await readFile(join(directory, 'current/index.html'), 'utf8');
  await requestPublication('second', { directory, force: true });
  await assert.rejects(publishStatic({ directory, force: true, build: async () => { throw new Error('build failed'); } }), /build failed/);
  assert.equal(await readFile(join(directory, 'current/index.html'), 'utf8'), old);
  assert.equal((await readdir(join(directory, 'queue'))).length, 1);
  await assert.rejects(stat(join(directory, 'lock')), { code: 'ENOENT' });
}));
test('publication arriving during a build is included by a second pass, never discarded', () => sandbox(async directory => {
  let builds = 0;
  await requestPublication('first', { directory, force: true });
  const result = await publishStatic({ directory, force: true, build: async (_, output) => {
    builds++;
    await fixture(output, `version${builds}`);
    if (builds === 1) await requestPublication('during-build', { directory, force: true });
  } });
  assert.equal(builds, 2);
  assert.equal(result.status, 'published');
  assert.ok((await readFile(join(directory, 'current/index.html'), 'utf8')).includes('version2'));
  assert.equal((await readdir(join(directory, 'queue'))).length, 0);
}));
test('old hashed CSS stays available and immutable assets cannot silently change', () => sandbox(async directory => {
  const old = await fixture(join(directory, 'old'), 'old');
  const fresh = await fixture(join(directory, 'fresh'), 'fresh');
  await mergeImmutableAssets(old, join(directory, 'assets'));
  await mergeImmutableAssets(fresh, join(directory, 'assets'));
  assert.deepEqual((await readdir(join(directory, 'assets/_astro'))).sort(), ['fresh.css', 'old.css']);
  await writeFile(join(fresh, '_astro/fresh.css'), 'changed');
  await assert.rejects(mergeImmutableAssets(fresh, join(directory, 'assets')), /collision/);
}));
test('validation refuses missing CSS and responsive variants that were not built', () => sandbox(async directory => {
  const client = await fixture(directory);
  await writeFile(join(client, 'index.html'), '<link href="/_astro/missing.css">');
  await assert.rejects(validateStatic(client), /Missing built asset/);
  await writeFile(join(client, 'index.html'), '<link href="/_astro/old.css"><img srcset="/_image?href=x&w=400 400w">');
  await assert.rejects(validateStatic(client), /Unbuilt responsive image/);
}));
test('replacing an original changes the versioned source URL without changing the media id', () => sandbox(async directory => {
  await writeFile(join(directory, 'image.webp'), 'original');
  const first = await versionedMediaUrl('/_emdash/api/media/file/image.webp', 'https://example.com', directory);
  assert.equal(first, await versionedMediaUrl('/_emdash/api/media/file/image.webp', 'https://example.com', directory));
  await writeFile(join(directory, 'image.webp'), 'replaced-image');
  const replaced = await versionedMediaUrl('/_emdash/api/media/file/image.webp', 'https://example.com', directory);
  assert.notEqual(first, replaced);
  assert.equal(new URL(first).pathname, new URL(replaced).pathname);
}));
test('a second publisher cannot run while another build holds the lock', () => sandbox(async directory => {
  let entered, proceed;
  const ready = new Promise(accept => { entered = accept; });
  const gate = new Promise(accept => { proceed = accept; });
  const first = publishStatic({ directory, force: true, build: async (_, output) => { entered(); await gate; await fixture(output); } });
  await ready;
  assert.equal((await publishStatic({ directory, force: true, build: async () => assert.fail('concurrent build') })).status, 'busy');
  proceed();
  assert.equal((await first).status, 'published');
}));
