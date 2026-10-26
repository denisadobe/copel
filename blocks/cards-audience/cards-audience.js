import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  claimDecoration, emptyMediaSlot, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

/*
 * Cards (audience)
 *
 * One row per audience tile:
 *   cell 1: picture (background image)                     (optional)
 *   cell 2: H2 title, bullet list of quick links, CTA link  (each optional)
 *
 * Output per tile:
 *   li.cards-audience-card
 *     div.cards-audience-card-image
 *     div.cards-audience-card-body
 *       .cards-audience-title  (heading)
 *       ul.cards-audience-links (revealed on hover / focus on wide screens)
 *       p.cards-audience-cta    (link paragraph(s) not inside the list)
 */

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    if (isEmptyRow(row, 'picture, img')) return;
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'cards-audience-card';

    const cells = [...row.children];
    // editor: an item just added has no media yet, keep [media | text] by position
    const imageCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim())
      || emptyMediaSlot(cells);
    const body = document.createElement('div');
    body.className = 'cards-audience-card-body';
    const textCells = cells.filter((c) => c !== imageCell);
    if (textCells.length === 1) moveInstrumentation(textCells[0], body);
    textCells.forEach((c) => {
      while (c.firstChild) body.append(c.firstChild);
    });

    if (imageCell) {
      imageCell.className = 'cards-audience-card-image';
      li.append(imageCell);
    }

    const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) heading.classList.add('cards-audience-title');

    body.querySelectorAll(':scope > ul, :scope > ol').forEach((list) => list.classList.add('cards-audience-links'));

    [...body.children].forEach((el) => {
      if (el.tagName !== 'P') return;
      const a = el.querySelector('a[href]');
      if (a && a.textContent.trim() === el.textContent.trim()) {
        el.classList.add('cards-audience-cta');
        el.classList.remove('button-container');
        a.classList.remove('button', 'primary', 'secondary');
      }
    });

    li.append(body);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    if (!img.getAttribute('src')) return;
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 900px)', width: '1200' }, { width: '750' }]));
  });

  block.replaceChildren(ul);
}
