// Crawls the real rendered site, so the warm set matches its actual src/srcset.
// No credentials, Directus access, database writes, or private admin pages.
const base = new URL(process.env.EMDASH_SITE_URL || 'http://127.0.0.1:4322');
const pages = new Set(['/', '/recent/', '/presentation/']);
const visited = new Set();
const images = new Set();
const decode = value => value.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
async function get(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) { last = error; }
  }
  throw last;
}
for (const path of pages) {
  if (visited.has(path)) continue;
  visited.add(path);
  const response = await get(new URL(path, base));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const html = await response.text();
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^\/(?:blog\/[^?#]+|(?:recent\/)?page\/\d+\/)\/?$/.test(href)) pages.add(decode(href));
  }
  for (const [, value] of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const candidate of decode(value).split(',')) {
      const source = candidate.trim().split(/\s+/)[0];
      if (!source) continue;
      const image = new URL(source, base);
      if (image.origin === base.origin && image.pathname === '/_image') images.add(image.href);
    }
  }
}
const queue = [...images];
let next = 0;
let hits = 0;
async function worker() {
  while (next < queue.length) {
    const index = next++;
    const response = await get(queue[index]);
    if (!response.ok || response.headers.get('Content-Type') !== 'image/webp') throw new Error(`Image ${index}: HTTP ${response.status} ${response.headers.get('Content-Type')}`);
    if (response.headers.get('X-Image-Cache') === 'HIT') hits++;
    await response.arrayBuffer();
    if ((index + 1) % 100 === 0) console.log(`${index + 1}/${queue.length} variants warmed`);
  }
}
await Promise.all([worker(), worker()]);
console.log(JSON.stringify({ pages: visited.size, variants: queue.length, alreadyCached: hits }));
