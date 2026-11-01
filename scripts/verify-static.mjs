import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';
import sharp from 'sharp';
import { filesUnder, validateStatic } from './publisher.mjs';
const directory = process.argv[2] || 'dist/client';
const audit = await validateStatic(directory);
const files = await filesUnder(directory);
const articles = files.filter(path => /[\\/]blog[\\/][^\\/]+[\\/]index\.html$/.test(path));
assert.ok(articles.length > 0, 'No prerendered articles');
let images = 0, galleries = 0, videos = 0, tables = 0;
for (const path of articles) {
  const $ = load(await readFile(path, 'utf8'));
  images += $('.article-prose img').length;
  galleries += $('.article-prose .image-group').length;
  videos += $('.article-prose .video-placeholder').length;
  tables += $('.article-prose table').length;
  $('.article-prose img').each((_, image) => assert.ok($(image).attr('alt')));
}
const homepage = load(await readFile(join(directory, 'index.html'), 'utf8'));
assert.equal(homepage('.article-row').length, Math.min(10, articles.length));
assert.ok(!homepage('astro-island').length, 'Public homepage should not hydrate React');
for (const path of ['search/index.html', 'statistiques/index.html', 'preview/index.html', 'api/statistiques/count/index.html']) {
  await assert.rejects(stat(join(directory, path)), { code: 'ENOENT' });
}
const imageFiles = files.filter(path => /[\\/]_astro[\\/].*\.webp$/.test(path));
assert.ok(imageFiles.length > 0, 'No pregenerated WebP');
for (const path of imageFiles.slice(0, 5)) assert.equal((await sharp(path).metadata()).format, 'webp');
for (const path of ['rss.xml', 'robots.txt', 'sitemap.xml']) assert.ok((await stat(join(directory, path))).size);
console.log(JSON.stringify({ ...audit, articles: articles.length, images, galleries, videos, tables, pregeneratedWebp: imageFiles.length, css: 'all linked assets exist', dynamicRoutes: 'not emitted as static HTML', publicReactHydration: false }));
