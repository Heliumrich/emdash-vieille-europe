export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export function fitImage(source: Size, viewport: Size): Size {
  const ratio = Math.min(1, viewport.width / source.width, viewport.height / source.height);
  return { width: source.width * ratio, height: source.height * ratio };
}

export function clampPan(pan: Point, image: Size, viewport: Size, scale: number): Point {
  const limitX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const limitY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return { x: limitX ? Math.max(-limitX, Math.min(limitX, pan.x)) : 0, y: limitY ? Math.max(-limitY, Math.min(limitY, pan.y)) : 0 };
}

// Keep the image point under the cursor/pinch midpoint while zooming.
export function zoomPan(pan: Point, from: Point, to: Point, oldScale: number, newScale: number): Point {
  const ratio = newScale / oldScale;
  return { x: to.x - (from.x - pan.x) * ratio, y: to.y - (from.y - pan.y) * ratio };
}
