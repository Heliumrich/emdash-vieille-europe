import { defineMiddleware } from 'astro:middleware';
import { cachedImage } from './lib/image-cache';
import { requestPublication } from '../plugins/static-publisher/queue.js';
export const onRequest = defineMiddleware(async ({ request, url, isPrerendered }, next) => {
  if (isPrerendered) return next();
  const response = await cachedImage(request, next);
  // These documented admin REST writes have no equivalent content publication hook.
  const settingsWrite = /^\/_emdash\/api\/(?:settings|menus|taxonomies)(?:\/|$)/.test(url.pathname);
  const replacedImage = /^\/_emdash\/api\/media\/[^/]+\/(?:replace|confirm)$/.test(url.pathname);
  if (response.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && (settingsWrite || replacedImage)) {
    await requestPublication('admin-metadata-changed').catch(error => console.error('[publisher] Failed to queue metadata change', error));
  }
  return response;
});
