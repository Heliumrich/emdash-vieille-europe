/** Captions follow the same authoring rule as Directus, using native PT only. */
export function withFigureCaptions(value = []) {
  const result = [];
  for (let i = 0; i < value.length; i++) {
    const block = value[i];
    const next = value[i + 1];
    const isFigure = block._type === 'image' || block._type === 'gallery';
    const hasCaption = block.caption || block.images?.some(image => image.caption);
    const isCaption = next?._type === 'block' && (!next.style || next.style === 'normal') && !next.listItem
      && next.children?.some(span => span.text?.trim())
      && next.children.every(span => span._type === 'span' && (!span.text.trim() || span.marks?.includes('em')));
    if (isFigure && !hasCaption && isCaption) {
      result.push({ ...block, captionBlocks: [next] });
      i++;
    } else result.push(block);
  }
  return result;
}
