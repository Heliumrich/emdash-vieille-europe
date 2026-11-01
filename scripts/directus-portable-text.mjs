import { load } from 'cheerio';
import { prosemirrorToPortableText, portableTextToProsemirror } from 'emdash';
import { normalizeImageGroups } from './image-groups.mjs';
import { assetId } from './images.mjs';

export const DIRECTUS_URL = 'https://admin.vieille-europe.ch';
const normalizeText = text => text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
export function youtubeId(value = '') {
  try {
    const url = new URL(value, DIRECTUS_URL);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).match(/^[\w-]{11}$/)?.[0];
    if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      return (url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] || '').match(/^[\w-]{11}$/)?.[0];
    }
  } catch { /* Not an external URL. */ }
}
export function localizeLink(href = '') {
  try {
    const url = new URL(href, 'https://vieille-europe.ch');
    if (!['vieille-europe.ch', 'www.vieille-europe.ch'].includes(url.hostname)) return href;
    if (url.pathname === '/' || /^\/(?:blog|page|recent|presentation)(?:\/|$)/.test(url.pathname)) return `${url.pathname}${url.search}${url.hash}`;
    return `/blog/${url.pathname.replace(/^\/+|\/+$/g, '')}/${url.search}${url.hash}`;
  } catch { return href; }
}

/** Convert HTML into native, editable EmDash blocks. No stored HTML wrapper. */
export function convertArticle(html, { title = '', files = [] } = {}) {
  const $ = load(html || '', { xmlMode: false }, false);
  normalizeImageGroups($);
  const metadata = new Map(files.map(file => [file.id, file]));
  let sequence = 0;
  let imageSequence = 0;
  const key = () => `ve${++sequence}`;
  const blocks = [];
  const textBlock = (nodes, style = 'normal', extra = {}) => {
    const markDefs = [];
    const children = [];
    function walk(node, marks = []) {
      if (node.type === 'text') {
        if (node.data) children.push({ _type: 'span', _key: key(), text: node.data.replace(/\u00a0/g, ' '), marks });
        return;
      }
      if (node.type !== 'tag') return;
      if (node.name === 'br') { children.push({ _type: 'span', _key: key(), text: '\n', marks }); return; }
      const mark = { em: 'em', i: 'em', strong: 'strong', b: 'strong', u: 'underline', s: 'strike-through', sub: 'subscript', sup: 'superscript', code: 'code' }[node.name];
      let next = mark ? [...marks, mark] : marks;
      if (node.name === 'a') {
        const href = localizeLink($(node).attr('href'));
        if (/^(https?:|mailto:|\/|#)/i.test(href)) {
          const id = key();
          markDefs.push({ _key: id, _type: 'link', href, ...($(node).attr('target') === '_blank' ? { blank: true } : {}) });
          next = [...next, id];
        }
      }
      for (const child of node.children || []) walk(child, next);
    }
    for (const node of nodes) walk(node);
    return { _type: 'block', _key: key(), style, markDefs, children: children.length ? children : [{ _type: 'span', _key: key(), text: '', marks: [] }], ...extra };
  };
  const imageBlock = node => {
    const img = $(node);
    imageSequence++;
    const src = new URL(img.attr('src'), DIRECTUS_URL).href;
    let file;
    try { file = metadata.get(assetId(src, DIRECTUS_URL)); } catch { /* External image. */ }
    const alt = img.attr('alt');
    return { _type: 'image', _key: key(), asset: { _type: 'reference', _ref: src, url: src, provider: 'external' },
      alt: alt && !/^(img|image|\d)[\w.-]*$/i.test(alt) ? alt : `${title} — illustration ${imageSequence}`,
      ...(file?.width && file?.height ? { width: file.width, height: file.height } : {}),
      ...(img.attr('title') ? { title: img.attr('title') } : {}) };
  };
  function visit(node, extra = {}) {
    if (node.type === 'text') { if (node.data.trim()) blocks.push(textBlock([node], 'normal', extra)); return; }
    if (node.type !== 'tag') return;
    const element = $(node);
    if (['script', 'style'].includes(node.name)) return;
    if (node.name === 'figure' || element.is('.image-pair,[class*="two-images-side-by-side"]')) {
      const imgs = element.find('img').toArray();
      if (imgs.length) {
        const images = imgs.map(imageBlock);
        const cap = element.children('figcaption');
        const caption = cap.length ? textBlock(cap.contents().toArray()) : undefined;
        const plainCaption = caption && !caption.markDefs.length && caption.children.every(span => !span.marks.length || span.marks.every(mark => mark === 'em'));
        if (images.length === 1) {
          if (plainCaption) images[0].caption = caption.children.map(span => span.text).join('');
          blocks.push(images[0]);
        } else blocks.push({ _type: 'gallery', _key: key(), images, columns: 2 });
        if (caption && (!plainCaption || images.length > 1)) {
          caption.children.forEach(span => { if (!span.marks.includes('em')) span.marks.push('em'); });
          blocks.push(caption);
        }
        return;
      }
    }
    if (node.name === 'img') { blocks.push(imageBlock(node)); return; }
    const video = node.name === 'iframe' ? youtubeId(element.attr('src')) : node.name === 'a' ? youtubeId(element.attr('href')) : null;
    if (video && (node.name === 'iframe' || element.hasClass('video-link'))) {
      blocks.push({ _type: 'iframe', _key: key(), src: `https://www.youtube-nocookie.com/embed/${video}`, title: title || 'Vidéo du réseau', width: 1280, height: 720, allowFullscreen: true }); return;
    }
    if (node.name === 'table') {
      const pm = { type: 'table', content: element.find('tr').toArray().map(row => ({ type: 'tableRow', content: $(row).children('td,th').toArray().map(cell => {
        const block = textBlock($(cell).contents().toArray());
        const inline = portableTextToProsemirror([block]).content[0]?.content || [];
        return { type: cell.name === 'th' ? 'tableHeader' : 'tableCell', attrs: { colspan: Number($(cell).attr('colspan')) || 1, rowspan: Number($(cell).attr('rowspan')) || 1 }, content: [{ type: 'paragraph', content: inline }] };
      }) })) };
      blocks.push(...prosemirrorToPortableText({ type: 'doc', content: [pm] }).map(block => ({ ...block, _key: key() })));
      return;
    }
    if (node.name === 'ul' || node.name === 'ol') {
      const listId = key();
      for (const li of element.children('li').toArray()) {
        const inline = $(li).contents().toArray().filter(child => !['ul', 'ol'].includes(child.name));
        blocks.push(textBlock(inline, 'normal', { listItem: node.name === 'ol' ? 'number' : 'bullet', level: (extra.level || 0) + 1, listId, ...(node.name === 'ol' ? { listStart: Number(element.attr('start')) || 1 } : {}) }));
        for (const nested of $(li).children('ul,ol').toArray()) visit(nested, { level: (extra.level || 0) + 1 });
      }
      return;
    }
    if (node.name === 'blockquote') {
      const ps = element.children('p');
      if (ps.length) ps.each((_, p) => blocks.push(textBlock($(p).contents().toArray(), 'blockquote')));
      else blocks.push(textBlock(element.contents().toArray(), 'blockquote'));
      return;
    }
    if (node.name === 'hr') { blocks.push({ _type: 'break', _key: key(), style: 'lineBreak' }); return; }
    if (/^(p|h[1-6]|center)$/.test(node.name) && !element.find('img,iframe,a.video-link').length) {
      const align = element.attr('style')?.match(/text-align:\s*(center|left|right|justify)/)?.[1] || (node.name === 'center' || element.is('.center,.text-center,.middle-text,.middle-italic-text') ? 'center' : undefined);
      blocks.push(textBlock(element.contents().toArray(), /^h[1-6]$/.test(node.name) ? node.name : 'normal', align ? { textAlign: align } : {})); return;
    }
    // Layout containers are not content. Descend, preserving each real block.
    for (const child of node.children || []) visit(child, extra);
  }
  for (const node of $.root().contents().toArray()) visit(node);
  // Fail before import if the editor cannot open a native block.
  portableTextToProsemirror(blocks);
  // These controls become native video blocks; their UI labels are theme copy.
  $('a.video-link').empty();
  return { blocks, normalizedHtml: $.html(), sourceText: normalizeText($.root().text()) };
}

export function blockText(blocks) {
  const parts = [];
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (value._type === 'span') parts.push(value.text);
    if (typeof value.caption === 'string') parts.push(value.caption);
    if (typeof value.text === 'string' && value._type !== 'span') parts.push(value.text);
    for (const [key, child] of Object.entries(value)) if (!['caption', 'text', 'markDefs', 'asset'].includes(key)) {
      if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child);
    }
  };
  blocks.forEach(walk);
  return normalizeText(parts.join(' '));
}
