import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { cachedImage } from '../src/lib/image-cache.ts';
test('disk variants survive repeat requests, revalidate and invalidate on original replacement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 've-image-cache-'));
  const filename = `test-${randomUUID()}.webp`;
  const source = resolve('uploads', filename);
  const previous = process.env.EMDASH_IMAGE_CACHE_DIR;
  process.env.EMDASH_IMAGE_CACHE_DIR = directory;
  await mkdir(resolve('uploads'), { recursive: true });
  await writeFile(source, 'source-one');
  const url = `http://localhost/_image?href=${encodeURIComponent(`http://localhost/_emdash/api/media/file/${filename}`)}&w=400&f=webp&q=80`;
  let transforms = 0;
  const next = async () => { transforms++; return new Response(`variant-${transforms}`, { headers: { 'Content-Type': 'image/webp', ETag: `"v${transforms}"`, 'Cache-Control': 'public, max-age=0, must-revalidate' } }); };
  try {
    const first = await cachedImage(new Request(url), next);
    assert.equal(first.headers.get('X-Image-Cache'), 'MISS');
    const second = await cachedImage(new Request(url), next);
    assert.equal(second.headers.get('X-Image-Cache'), 'HIT');
    assert.equal(await first.text(), await second.text());
    assert.equal(transforms, 1);
    const conditional = await cachedImage(new Request(url, { headers: { 'If-None-Match': '"v1"' } }), next);
    assert.equal(conditional.status, 304);
    await writeFile(source, 'replaced-source-two');
    const replaced = await cachedImage(new Request(url), next);
    assert.equal(replaced.headers.get('X-Image-Cache'), 'MISS');
    assert.equal(transforms, 2);
    assert.equal(await replaced.text(), 'variant-2');
  } finally {
    if (previous === undefined) delete process.env.EMDASH_IMAGE_CACHE_DIR;
    else process.env.EMDASH_IMAGE_CACHE_DIR = previous;
    assert.ok(source.startsWith(resolve('uploads') + sep));
    await rm(source, { force: true });
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
