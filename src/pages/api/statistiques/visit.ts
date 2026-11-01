import type { APIRoute } from 'astro';
import { database, invalidate } from '../../../lib/statistics';
import { isBot } from '../../../../scripts/statistics-store.mjs';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  const origin = process.env.STATS_ORIGIN || process.env.EMDASH_SITE_URL || 'https://test.vieille-europe.ch';
  if (request.headers.get('origin') !== origin || isBot(request.headers.get('user-agent'))
    || request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 403, headers });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415, headers });
  try {
    // Nginx caps this at 1 KB as well. Bound reads even in direct dev access.
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 1024) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!uuid.test(body.visitor || '') || !uuid.test(body.event || '')) return new Response(null, { status: 400, headers });
    database().record(body.visitor, body.event); invalidate();
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 400, headers }); }
};
