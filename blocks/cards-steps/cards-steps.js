import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Cards (steps)
 *
 * One row per step:
 *   cell 1: icon image (optional; :icon: spans also accepted)
 *   cell 2: H3 step title + description paragraph(s)
 *
 * Renders an ordered list so the step sequence is exposed to assistive tech.
 */

const isMediaOnly = (el) => !!el.querySelector('picture, img, span.icon') && !el.textContent.trim();

export default function decorate(block) {
  const ol = document.createElement('ol');
  ol.className = 'cards-steps-list';

  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img, span.icon')) return;
    const li = document.createElement('li');
    li.className = 'cards-steps-item';

    const cells = [...row.children];
    const iconCell = cells.find(isMediaOnly);
    if (iconCell) {
      iconCell.className = 'cards-steps-icon';
      li.append(iconCell);
    }

    const body = document.createElement('div');
    body.className = 'cards-steps-body';
    cells.filter((c) => c !== iconCell).forEach((c) => body.append(...c.childNodes));
    body.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('cards-steps-title');
    if (body.childNodes.length) li.append(body);

    ol.append(li);
  });

  ol.querySelectorAll('picture > img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // inline (data-URI) and SVG icons are multicolor illustrations: keep as-is,
    // createOptimizedPicture would mangle them (src="nullimage/svg+xml...")
    if (src.startsWith('data:') || src.split('?')[0].endsWith('.svg')) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]));
  });

  block.replaceChildren(ol);
}
