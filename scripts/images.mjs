// Directus presets: square bounds, fit=inside, withoutEnlargement=true, WebP 80.
// Their names are the only transformation parameters exposed to visitors.
export const IMAGE_PRESETS = [
  { key: 'small', width: 600 },
  { key: 'medium', width: 1200 },
  { key: 'large', width: 2000 },
  { key: 'xlarge', width: 4000 },
];

// "auto" uses the actual rendered width for lazy images in supporting browsers.
// The fallback follows the reading column's CSS, including its side margin.
export const READING_IMAGE_SIZES = 'auto, (max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc(100vw - 215px), (max-width: 1132px) calc(100vw - 322px), 810px';
export const COVER_IMAGE_SIZES = 'auto, (max-width: 760px) calc(100vw - 76px), (max-width: 1100px) calc(27vw - 22px), 360px';

export function assetId(source, base) {
  const url = new URL(source, base);
  // WYSIWYG uploads can use /assets/UUID.jpeg; older content uses UUID or
  // UUID/filename.jpeg. Only the UUID is needed to rebuild the preset URLs.
  const match = url.pathname.match(/^\/assets\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:\.[a-z0-9]+)?(?:\/[^/]*)?$/i);
  if (url.origin !== new URL(base).origin || !match || !['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Image extérieure à Directus ou identifiant de fichier invalide.');
  }
  return match[1];
}

export function responsiveAsset(file, base) {
  const width = Number(file.width);
  const height = Number(file.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Dimensions Directus absentes ou invalides : ${file.id}`);
  }
  const candidates = [];
  for (const preset of IMAGE_PRESETS) {
    // With fit=inside, a portrait's output width is smaller than the square's
    // width. Describe that real width, not the preset's longest edge.
    const candidateWidth = Math.max(1, Math.round(width * Math.min(1, preset.width / Math.max(width, height))));
    if (candidates.some(candidate => candidate.width === candidateWidth)) continue;
    const url = new URL(`/assets/${file.id}`, base);
    url.searchParams.set('key', preset.key);
    candidates.push({ key: preset.key, url: url.href, width: candidateWidth });
  }
  const fallback = candidates.find(candidate => candidate.key === 'medium') || candidates.at(-1);
  return {
    src: fallback.url,
    srcset: candidates.map(candidate => `${candidate.url} ${candidate.width}w`).join(', '),
    width,
    height,
    full: candidates.at(-1).url,
  };
}
