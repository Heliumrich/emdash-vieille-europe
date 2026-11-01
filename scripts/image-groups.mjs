// Directus 12 can unwrap legacy layout divs, leaving adjacent image nodes.
// Adjacent bare images are a row; paragraph/line breaks remain real separators.
export function normalizeImageGroups($) {
  const isImage = node => node.type === 'tag' && (node.name === 'img'
    || (node.name === 'a' && $(node).find('img').length === 1 && !$(node).text().trim()));
  const whitespace = node => node.type === 'text' && !node.data.trim();
  const entirelyItalic = (node, italic = false) => {
    if (node.type === 'text') return !node.data.trim() || italic;
    if (node.type !== 'tag') return true;
    if (node.name === 'br') return true;
    if (!['p', 'em', 'i', 'strong', 'b', 'a', 'span', 'u', 's', 'sub', 'sup'].includes(node.name)) return false;
    return (node.children || []).every(child => entirelyItalic(child, italic || ['em', 'i'].includes(node.name)));
  };
  const captionAfter = element => {
    const following = element.next('p');
    return following.text().trim()
      && (following.hasClass('image-caption') || entirelyItalic(following[0])) ? following : null;
  };
  const attachCaption = (figure, following) => {
    figure.append($('<figcaption></figcaption>').append(following.contents()));
    following.remove();
  };
  for (const parent of [$.root()[0], ...$('div,p').toArray()]) {
    const element = $(parent);
    if (element.closest('figure,.image-pair,[class*="two-images-side-by-side"]').length) continue;
    const children = element.contents().toArray();
    if (parent.name === 'p' && !children.every(node => whitespace(node) || isImage(node))) continue;
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const row = $('<div class="image-pair"></div>');
        if (parent.name === 'p') element.replaceWith(row);
        else $(run[0]).before(row);
        for (const image of run) row.append(image);
      }
      run = [];
    };
    for (const child of children) {
      if (isImage(child)) run.push(child);
      else if (!whitespace(child)) flush();
    }
    flush();
  }

  $('.image-pair,[class*="two-images-side-by-side"]').each((_, row) => {
    const images = $(row);
    let figure = images.parent('figure');
    if (!figure.length) {
      figure = $('<figure class="image-group"></figure>');
      images.before(figure);
      figure.append(images);
    }
    figure.addClass('image-group');
    if (figure.children('figcaption').length) return;
    const following = captionAfter(figure);
    // Authoring convention: a whole italic paragraph immediately below the image(s)
    // is its caption. No special format or directional wording is necessary.
    if (following) attachCaption(figure, following);
  });

  $('img').each((_, image) => {
    let block = $(image);
    const figure = block.closest('figure');
    if (figure.length) {
      if (figure.find('img').length !== 1 || figure.children('figcaption').length) return;
      const following = captionAfter(figure);
      if (following) attachCaption(figure, following);
      return;
    }
    if (block.closest('.image-pair,[class*="two-images-side-by-side"]').length) return;
    if (block.parent('a').length) block = block.parent();
    if (!isImage(block[0])) return;
    if (block.parent('p').length) {
      const paragraph = block.parent();
      if (!paragraph.contents().toArray().every(node => whitespace(node) || node === block[0])) return;
      block = paragraph;
    }
    const following = captionAfter(block);
    if (!following) return;
    const wrapper = $('<figure></figure>');
    block.before(wrapper);
    if (block.is('p')) {
      wrapper.append(block.contents());
      block.remove();
    } else wrapper.append(block);
    attachCaption(wrapper, following);
  });
}
