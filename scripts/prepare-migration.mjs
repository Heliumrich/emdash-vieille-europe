import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { convertArticle, blockText, DIRECTUS_URL } from './directus-portable-text.mjs';

await mkdir('.migration', { recursive: true });
async function get(path) {
  const response = await fetch(`${DIRECTUS_URL}${path}`);
  if (!response.ok) throw new Error(`Directus ${response.status}: ${path}`);
  const result = await response.json();
  if (!Array.isArray(result.data)) throw new Error(`Invalid Directus response: ${path}`);
  return result.data;
}
const snapshot = process.argv.includes('--offline') ? JSON.parse(await readFile('.migration/directus.json', 'utf8')) : {
  articles: await get('/items/blog?fields=id,title,slug,excerpt,article,date,archived,status&limit=-1&sort=date,date_created,id'),
  pages: await get('/items/pages?fields=id,title,content,archived&limit=-1'),
  files: await get('/files?fields=id,width,height,type,filename_download&limit=-1'),
};
await writeFile('.migration/directus.json', JSON.stringify(snapshot, null, 2));
const entries = [];
const report = [];
const auditText = text => text.replace(/\s/g, '');
for (const item of snapshot.articles.filter(item => !item.archived)) {
  const { blocks, normalizedHtml, sourceText } = convertArticle(item.article, { title: item.title, files: snapshot.files });
  const convertedText = blockText(blocks);
  if (auditText(sourceText) !== auditText(convertedText)) throw new Error(`Text changed in ${item.slug}: ${sourceText.length} / ${convertedText.length}`);
  const $ = load(normalizedHtml);
  const first = blocks.flatMap(block => block._type === 'gallery' ? block.images : block._type === 'image' ? [block] : []).at(0);
  const images = blocks.reduce((n, block) => n + (block._type === 'image' ? 1 : block._type === 'gallery' ? block.images.length : 0), 0);
  if (images !== $('img').length) throw new Error(`Lost image in ${item.slug}`);
  entries.push({ collection: 'posts', slug: item.slug, status: item.status === 'publié' ? 'published' : 'draft', publishedAt: `${item.date}T12:00:00.000Z`, data: {
    title: item.title, content: blocks, excerpt: item.excerpt || sourceText.slice(0, 230),
    ...(first ? { featured_image: { id: first.asset.url, src: first.asset.url, provider: 'external', alt: first.alt, width: first.width, height: first.height } } : {}),
  } });
  report.push({ slug: item.slug, status: item.status, images, galleries: blocks.filter(b => b._type === 'gallery').length, tables: blocks.filter(b => b._type === 'table').length, videos: blocks.filter(b => b._type === 'iframe').length, textVerified: true });
}
const page = snapshot.pages.find(item => item.title === 'presentation' && !item.archived);
if (!page) throw new Error('Presentation missing');
const presentation = convertArticle(page.content, { title: 'Présentation', files: snapshot.files });
if (auditText(presentation.sourceText) !== auditText(blockText(presentation.blocks))) throw new Error('Presentation text changed');
entries.push({ collection: 'pages', slug: 'presentation', status: 'published', data: { title: 'Présentation', content: presentation.blocks } });
await writeFile('.migration/entries.json', JSON.stringify(entries));
await writeFile('.migration/report.json', JSON.stringify(report, null, 2));
const seed = JSON.parse(await readFile('seed/seed.json', 'utf8'));
seed.content = {};
for (const { collection, slug, status, data } of entries) (seed.content[collection] ??= []).push({ id: slug, slug, status, data });
await writeFile('.migration/preview-seed.json', JSON.stringify(seed));
console.log(JSON.stringify({ posts: report.length, published: report.filter(r => r.status === 'publié').length, images: report.reduce((n,r) => n+r.images,0), galleries: report.reduce((n,r) => n+r.galleries,0), videos: report.reduce((n,r) => n+r.videos,0), tables: report.reduce((n,r) => n+r.tables,0), presentation: true }));
