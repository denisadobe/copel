import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  IS_UE, claimDecoration, emptyMediaSlot, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

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
  if (!claimDecoration(block)) return;
  const ol = document.createElement('ol');
  ol.className = 'cards-steps-list';

  [...block.children].forEach((row) => {
    if (isEmptyRow(row)) return;
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'cards-steps-item';

    const cells = [...row.children];
    // editor: an item just added has no media yet, keep [media | text] by position
    const iconCell = cells.find(isMediaOnly)
      || emptyMediaSlot(cells);
    if (iconCell) {
      iconCell.className = 'cards-steps-icon';
      li.append(iconCell);
    }

    const body = document.createElement('div');
    body.className = 'cards-steps-body';
    const textCells = cells.filter((c) => c !== iconCell);
    if (textCells.length === 1) moveInstrumentation(textCells[0], body);
    textCells.forEach((c) => body.append(...c.childNodes));
    body.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('cards-steps-title');
    if (body.childNodes.length || IS_UE) li.append(body);

    ol.append(li);
  });

  ol.querySelectorAll('picture > img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // inline (data-URI) and SVG icons are multicolor illustrations: keep as-is,
    // createOptimizedPicture would mangle them (src="nullimage/svg+xml...")
    if (!src || src.startsWith('data:') || src.split('?')[0].endsWith('.svg')) return;
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]));
  });

  block.replaceChildren(ol);
}
