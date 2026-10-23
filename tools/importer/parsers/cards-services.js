/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-services
 * Source: Elementor icon-list widget ".atalhosHome" (.elementor-element-f449e99).
 *   li.elementor-icon-list-item > a[href] > span.elementor-icon-list-icon (svg | img | i)
 *                                         + span.elementor-icon-list-text
 *
 * Output rows (one per service):
 *   cell 1: icon <img> (SVG source) - empty when only an icon font is available
 *   cell 2: <p><a href>label</a></p>
 */

/** Build an <img> for an icon container: <img src> or inline <svg>; icon fonts are skipped. */
function iconImg(document, container) {
  if (!container) return null;
  const src = container.querySelector('img[src]');
  if (src && src.getAttribute('src')) {
    const img = document.createElement('img');
    img.src = src.getAttribute('src');
    img.alt = src.getAttribute('alt') || '';
    return img;
  }
  const svg = container.querySelector('svg');
  if (svg) {
    let markup = svg.outerHTML;
    if (!/xmlns=/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = document.createElement('img');
    try {
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
    } catch (e) {
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    }
    img.alt = '';
    return img;
  }
  return null;
}

export default function parse(element, { document }) {
  const cells = [];

  element.querySelectorAll('li.elementor-icon-list-item').forEach((item) => {
    const link = item.querySelector('a[href]');
    const textEl = item.querySelector('.elementor-icon-list-text');
    const label = (textEl || link || item).textContent.replace(/\s+/g, ' ').trim();
    if (!label) return;

    const icon = iconImg(document, item.querySelector('.elementor-icon-list-icon'));

    const p = document.createElement('p');
    if (link) {
      const a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = label;
      p.append(a);
    } else {
      p.textContent = label;
    }

    cells.push([icon || '', p]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-services', cells });
  element.replaceWith(block);
}
