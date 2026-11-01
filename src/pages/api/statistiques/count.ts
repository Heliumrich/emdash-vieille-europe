import type { APIRoute } from 'astro';
import { database } from '../../../lib/statistics';
export const prerender = false;
export const GET: APIRoute = () => Response.json({ total: database().total() }, {
  headers: { 'Cache-Control': 'public, max-age=15', 'X-Robots-Tag': 'noindex, nofollow' },
});
