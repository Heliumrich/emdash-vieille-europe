import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { blockText } from './directus-portable-text.mjs';
const base = process.env.EMDASH_SITE_URL || 'http://127.0.0.1:4322';
const entries = JSON.parse(await readFile('.migration/entries-local.json', 'utf8'));
const squash = text => text.replace(/\s/g, '');
async function page(path, status = 200) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(!html.includes('admin.vieille-europe.ch'), `Directus dependency: ${path}`);
  return load(html);
}
let images = 0, galleries = 0, videos = 0, tables = 0;
for (const entry of entries) {
  if (entry.collection !== 'posts') continue;
  const $ = await page(`/blog/${entry.slug}/`);
  assert.equal($('h1').text(), entry.data.title);
  assert.equal($('.article-header time').attr('datetime'), entry.publishedAt);
  images += $('.article-prose img').length;
  galleries += $('.article-prose .image-group').length;
  videos += $('.article-prose .video-placeholder').length;
  tables += $('.article-prose table').length;
  $('.video-placeholder').remove();
  assert.equal(squash($('.article-prose').text()), squash(blockText(entry.data.content)), `Text changed in ${entry.slug}`);
  assert.ok(!/(?:weg|strasse|straße|gasse)\s+\d+\s+à\s+\d{4}/i.test($('.article-prose').text()), 'Personal postal address');
  $('.article-prose img').each((_, img) => {
    assert.ok($(img).attr('alt'));
    const variants = $(img).attr('srcset');
    assert.ok(variants && variants.includes('q=80') && variants.includes('f=webp'));
    for (const candidate of variants.split(',')) assert.ok(Number(candidate.trim().split(/\s+/).at(-1).slice(0, -1)) <= Number($(img).attr('width')), 'Upscaled candidate');
  });
}
assert.equal(images, 379);
assert.equal(galleries, 17);
assert.equal(videos, 5);
assert.equal(tables, 1);
for (const order of ['', '/recent']) {
  const actual = [];
  for (let index = 1; index <= 3; index++) {
    const $ = await page(index === 1 ? `${order}/` : `${order}/page/${index}/`);
    assert.equal($('.article-row').length, index === 3 ? 7 : 10);
    actual.push(...$('.article-row h3 a').map((_, link)=>$(link).attr('href')).get());
  }
  const expected = entries.filter(e=>e.collection==='posts').map(e=>`/blog/${e.slug}/`);
  assert.deepEqual(actual, order ? expected.reverse() : expected);
}
const presentation = await page('/presentation/');
assert.ok(!/Criblet|CH-1867/.test(presentation('.presentation-prose').text()));
assert.ok(presentation('.presentation-prose').text().includes('024.499.19.07'));
await page('/page/0/', 404);
await page('/blog/absent/', 404);
await page('/rss.xml');
await page('/sitemap.xml');
const $ = await page('/blog/la-magie-du-tinplate-0-de-style-suisse/');
const src = $('.article-prose img').attr('srcset').split(',')[0].trim().split(/\s+/)[0];
const first = await fetch(new URL(src, base));
assert.equal(first.headers.get('Content-Type'), 'image/webp');
await first.arrayBuffer();
const second = await fetch(new URL(src, base));
assert.equal(second.headers.get('X-Image-Cache'), 'HIT');
await second.arrayBuffer();
const conditional = await fetch(new URL(src, base), { headers: { 'If-None-Match': second.headers.get('ETag') } });
assert.equal(conditional.status, 304);
console.log(JSON.stringify({ posts: 27, images, galleries, videos, tables, pagination: 'both orders', text: 'verified', directusReferences: 0, webpQuality: 80, cache: 'HIT + 304' }));
