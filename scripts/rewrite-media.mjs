import { readFile, writeFile } from 'node:fs/promises';
import { portableTextToProsemirror } from 'emdash';
import { redactPostalText } from './redact-postal.mjs';
const entries = JSON.parse(await readFile('.migration/entries.json', 'utf8'));
const manifest = JSON.parse(await readFile('.migration/media-manifest.json', 'utf8'));
const media = JSON.parse(await readFile(process.env.EMDASH_MEDIA_MAP_PATH || '.migration/media-map.json', 'utf8'));
for (const file of manifest) {
  if (!media[file.id]) throw new Error(`Original not copied: ${file.id}`);
  if (media[file.id].size !== file.size || media[file.id].contentHash !== `sha1:${file.sha1}`) throw new Error(`Original not verified: ${file.id}`);
}
function originalId(url) {
  if (typeof url !== 'string') return undefined;
  return url.match(/^https:\/\/admin\.vieille-europe\.ch\/assets\/([\da-f-]{36})/)?.[1];
}
function rewrite(value) {
  if (!value || typeof value !== 'object') return;
  if (value._type === 'span' && typeof value.text === 'string') value.text = redactPostalText(value.text);
  const sourceId = originalId(value.asset?.url || value.asset?._ref);
  if (sourceId) {
    const file = media[sourceId];
    if (!file) throw new Error(`Missing referenced media ${sourceId}`);
    value.asset = { _type: 'reference', _ref: file.id, provider: 'local', url: file.url };
    value.width = file.width;
    value.height = file.height;
    value.blurhash = file.blurhash;
    value.dominantColor = file.dominantColor;
  }
  const hrefId = originalId(value.href);
  if (hrefId) value.href = media[hrefId].url;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(rewrite);
    else if (child && typeof child === 'object') rewrite(child);
  }
}
for (const entry of entries) {
  rewrite(entry.data.content);
  const cover = entry.data.featured_image;
  if (cover) {
    const file = media[originalId(cover.src)];
    if (!file) throw new Error(`Missing cover: ${entry.slug}`);
    entry.data.featured_image = { id: file.id, provider: 'local', src: file.url, alt: cover.alt, width: file.width, height: file.height, blurhash: file.blurhash, dominantColor: file.dominantColor, meta: { storageKey: file.storageKey } };
  }
  if (entry.collection === 'pages' && entry.slug === 'presentation') {
    let redactions = 0;
    for (const block of entry.data.content) for (const span of block.children || []) {
      if (typeof span.text === 'string') span.text = span.text.replace(/,\s*(?:Chemin|Rue|Route)\s+[^;\n]*?(?=,\s*tél\.)/gi, () => { redactions++; return ''; });
    }
    if (redactions !== 1) throw new Error(`Expected one postal-address redaction, got ${redactions}`);
  }
  portableTextToProsemirror(entry.data.content);
}
if (JSON.stringify(entries).includes('admin.vieille-europe.ch')) throw new Error('Directus dependency remains');
await writeFile(process.env.EMDASH_ENTRIES_OUTPUT || '.migration/entries-native.json', JSON.stringify(entries));
console.log(JSON.stringify({ originalsVerified: manifest.length, posts: entries.filter(e=>e.collection==='posts').length, presentation: true, directusReferences: 0 }));
