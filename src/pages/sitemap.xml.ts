import type { APIRoute } from 'astro';
import { getEmDashCollection, getSeoMeta } from 'emdash';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const GET: APIRoute = async ({ site }) => {
  const paths = new Set(['/']);
  let count = 0;
  for (const collection of ['posts', 'pages']) {
    let cursor: string | undefined;
    do {
      const result = await getEmDashCollection(collection, { status: 'published', cursor, limit: 100 });
      if (result.error) throw result.error;
      for (const entry of result.entries) {
        const path = collection === 'posts' ? `/blog/${entry.id}/` : `/${entry.id}/`;
        if (!getSeoMeta(entry, { siteUrl: site!.href, siteTitle: 'Vieille-Europe', path }).robots?.includes('noindex')) paths.add(path);
        if (collection === 'posts') count++;
      }
      cursor = result.nextCursor;
    } while (cursor);
  }
  for (let page = 2; page <= Math.ceil(count / 10); page++) paths.add(`/page/${page}/`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths].map(path=>`<url><loc>${escape(new URL(path, site).href)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
