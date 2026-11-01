import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArticle, blockText } from './directus-portable-text.mjs';
import { withFigureCaptions } from './article-blocks.mjs';
import { portableTextToProsemirror, prosemirrorToPortableText } from 'emdash';
const image = '<img src="https://admin.vieille-europe.ch/assets/11111111-1111-1111-1111-111111111111/photo.jpg" alt="Le train">';
test('native single caption takes priority over a following italic paragraph', () => {
  const { blocks } = convertArticle(`<figure>${image}<figcaption>La locomotive</figcaption></figure><p><em>Du texte à conserver.</em></p>`);
  assert.equal(blocks[0]._type, 'image');
  assert.equal(blocks[0].caption, 'La locomotive');
  assert.equal(withFigureCaptions(blocks).length, 2);
});
test('shared caption retains links and bold text after a native editor round trip', () => {
  const { blocks } = convertArticle(`${image}${image}<p><em>De <strong>gauche</strong> à droite : <a href="https://example.com">les deux trains</a>.</em></p>`);
  const roundTrip = prosemirrorToPortableText(portableTextToProsemirror(blocks));
  assert.equal(roundTrip[0]._type, 'gallery');
  assert.equal(roundTrip[0].images.length, 2);
  const rendered = withFigureCaptions(roundTrip);
  assert.equal(rendered.length, 1);
  assert.ok(rendered[0].captionBlocks[0].markDefs.some(mark => mark.href === 'https://example.com'));
  assert.ok(rendered[0].captionBlocks[0].children.some(span => span.marks.includes('strong')));
});
test('an empty paragraph and partial italics keep narrative separate from photos', () => {
  const separated = convertArticle(`${image}<p></p><p><em>Un récit.</em></p>`).blocks;
  assert.equal(withFigureCaptions(separated).length, 3);
  const partial = convertArticle(`${image}<p><em>Un début</em> de récit.</p>`).blocks;
  assert.equal(withFigureCaptions(partial).length, 2);
});
test('native table preserves cell text and formatting through the editor', () => {
  const { blocks } = convertArticle('<table><tr><th>Modèle</th><th>Année</th></tr><tr><td><strong>BUCO</strong></td><td>1954</td></tr></table>');
  assert.equal(blocks[0]._type, 'table');
  const roundTrip = prosemirrorToPortableText(portableTextToProsemirror(blocks));
  assert.equal(blockText(roundTrip), blockText(blocks));
});
