import { READING_IMAGE_SIZES } from '../../scripts/images.mjs';
export function photograph(node: Record<string, any>) {
  const asset = node.asset || {};
  const source = asset.url || asset.src;
  const image = { id: asset._ref || asset.id || '', src: source, provider: asset.provider, alt: node.alt || asset.alt || '', width: node.width || asset.width, height: node.height || asset.height, meta: asset.meta };
  return { image, full: source || `/_emdash/api/media/file/${image.id}`, sizes: READING_IMAGE_SIZES };
}
