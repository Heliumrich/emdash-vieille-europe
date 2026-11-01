import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { normalizeImageGroups } from './image-groups.mjs';

const image = id => `<a href="/assets/${id}"><img src="/assets/${id}"></a>`;
function normalize(html) { const $ = load(html, null, false); normalizeImageGroups($); return $; }
test('adjacent Directus image links form a row and share the migrated caption', () => {
  const $ = normalize(`${image(1)}\n${image(2)}<p><em>De gauche à droite, les deux wagons.</em></p>`);
  assert.equal($('figure.image-group > .image-pair > a').length, 2);
  assert.equal($('figure > figcaption > em').text(), 'De gauche à droite, les deux wagons.');
  assert.equal($('p').length, 0);
});
test('explicit shared-caption format works without directional wording', () => {
  const $ = normalize(`<p>${image(1)} ${image(2)}</p><p class="image-caption">Deux signaux de queue.</p>`);
  assert.equal($('figure.image-group').length, 1);
  assert.equal($('figcaption').text(), 'Deux signaux de queue.');
  assert.equal($('p').length, 0);
});
test('an entirely italic paragraph becomes the shared caption without a special format', () => {
  const $ = normalize(`${image(1)}${image(2)}<p><em>Deux signaux de queue.</em></p>`);
  assert.equal($('figure.image-group > figcaption').text(), 'Deux signaux de queue.');
  assert.equal($('figcaption em').length, 1);
  assert.equal($('p').length, 0);
});
test('all-italic captions can contain multiple fragments, links, bold text and line breaks', () => {
  const $ = normalize(`${image(1)}${image(2)}<p><em>Les </em><strong><em>deux</em></strong> <a href="https://example.com"><em>signaux</em></a><br><i>en détail.</i></p>`);
  assert.equal($('figcaption').text(), 'Les deux signauxen détail.');
  assert.equal($('figcaption a').attr('href'), 'https://example.com');
  assert.equal($('figcaption strong').length, 1);
});
test('separate image paragraphs and a line break do not accidentally become a pair', () => {
  const $ = normalize(`<p>${image(1)}</p><p>${image(2)}</p>${image(3)}<br>${image(4)}`);
  assert.equal($('.image-pair').length, 0);
  assert.equal($('img').length, 4);
});
test('existing layout groups are preserved and normalization is idempotent', () => {
  const $ = normalize(`<div class="image-pair">${image(1)}${image(2)}</div><p class="image-caption"><em>Deux vues.</em></p>`);
  const once = $.html();
  normalizeImageGroups($);
  assert.equal($.html(), once);
  assert.equal($('figure').length, 1);
  assert.equal($('figcaption').length, 1);
});
test('ordinary text following images stays a paragraph and individual figures stay separate', () => {
  const $ = normalize(`${image(1)}${image(2)}<p>Une <em>réflexion</em> sur le matériel.</p><figure>${image(3)}<figcaption>Trois.</figcaption></figure>`);
  assert.equal($('figure.image-group').length, 1);
  assert.equal($('figure.image-group figcaption').length, 0);
  assert.equal($('p').text(), 'Une réflexion sur le matériel.');
  assert.equal($('figure:not(.image-group) figcaption').text(), 'Trois.');
});
test('a blank paragraph separates an italic paragraph from the image row', () => {
  const $ = normalize(`${image(1)}${image(2)}<p><br></p><p><em>Un autre paragraphe.</em></p>`);
  assert.equal($('figure.image-group figcaption').length, 0);
  assert.equal($('p em').text(), 'Un autre paragraphe.');
});

test('single images accept an italic paragraph with or without a link or paragraph wrapper', () => {
  for (const html of ['<img src="/assets/1">', image(1), `<p>${image(1)}</p>`, '<p><img src="/assets/1"></p>']) {
    const $ = normalize(`${html}<p><em>Une <a href="/detail/">locomotive</a>.</em></p>`);
    assert.equal($('figure > figcaption').text(), 'Une locomotive.');
    assert.equal($('figcaption em a').attr('href'), '/detail/');
    assert.equal($('figure img').length, 1);
    assert.equal($('p, .image-group').length, 0);
    const once = $.html();
    normalizeImageGroups($);
    assert.equal($.html(), once);
  }
});

test('a single native figure accepts a following caption but preserves an existing caption', () => {
  const $ = normalize(`<figure>${image(1)}</figure><p class="image-caption">Une vue.</p><figure>${image(2)}<figcaption>Légende native.</figcaption></figure><p><em>Un récit.</em></p>`);
  assert.equal($('figure').length, 2);
  assert.deepEqual($('figcaption').map((_, node) => $(node).text()).get(), ['Une vue.', 'Légende native.']);
  assert.equal($('p em').text(), 'Un récit.');
});

test('single-image captions require an immediate, entirely italic paragraph', () => {
  for (const tail of ['<p>Une <em>partie</em> en italique.</p>', '<p><br></p><p><em>Un récit.</em></p>']) {
    const $ = normalize(`<p>${image(1)}</p>${tail}`);
    assert.equal($('figure, figcaption').length, 0);
  }
  const $ = normalize(`<p>Texte ${image(1)}</p><p><em>Un récit.</em></p>`);
  assert.equal($('figcaption').length, 0);
});

test('WYSIWYG paragraph alignment never changes caption recognition or survives on the caption', () => {
  for (const images of [image(1), `${image(1)}${image(2)}`]) {
    for (const alignment of ['left', 'center', 'right', 'justify']) {
      const $ = normalize(`${images}<p class="text-${alignment}" style="text-align: ${alignment}"><em>Une légende.</em></p>`);
      assert.equal($('figure > figcaption').text(), 'Une légende.');
      assert.equal($('figcaption > em').length, 1);
      assert.equal($('figcaption').attr('style'), undefined);
      assert.equal($('figcaption').attr('class'), undefined);
      assert.equal($('p').length, 0);
    }
  }
});
