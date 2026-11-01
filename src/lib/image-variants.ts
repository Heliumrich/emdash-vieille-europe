import { getImage } from 'astro:assets';
import type { ImageValue } from 'emdash';
import { versionedMediaUrl } from './media-version.mjs';
export const THUMBNAIL_WIDTHS = [240, 360, 480, 720];
export const ARTICLE_WIDTHS = [400, 600, 800, 1200, 1600, 2000];
export const GALLERY_WIDTHS = [240, 400, 600, 800, 1200];
export const LIGHTBOX_WIDTHS = [800, 1200, 1600, 2000, 2400, 3200, 4000];

/** Native Astro URLs, capped at the real original width (no duplicate upscales). */
export async function imageVariants(image: ImageValue | undefined, origin: URL | undefined, widths: number[]) {
  if (!image?.width || !image.height || !origin) return {};
  const source = image.src || `/_emdash/api/media/file/${image.meta?.storageKey || image.id}`;
  if (!source.startsWith('/_emdash/api/media/file/')) return {};
  const maximum = Math.min(image.width, widths.at(-1)!);
  const src = await versionedMediaUrl(source, origin);
  const candidates = [...new Set([...widths.filter(width => width < maximum), maximum])];
  const variants = await Promise.all(candidates.map(async width => {
    const result = await getImage({ src, width, height: Math.max(1, Math.round(image.height! * width / image.width!)), layout: 'none', format: 'webp', quality: 80 });
    return { src: result.src, width };
  }));
  return { src: variants.at(-1)?.src, srcset: variants.map(variant => `${variant.src} ${variant.width}w`).join(', ') };
}
