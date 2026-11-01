import { defineMiddleware } from 'astro:middleware';
import { cachedImage } from './lib/image-cache';
export const onRequest = defineMiddleware(({ request }, next) => cachedImage(request, next));
