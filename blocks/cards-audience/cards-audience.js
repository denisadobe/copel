import { createOptimizedPicture } from '../../scripts/aem.js';

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
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img')) return;
    const li = document.createElement('li');
    li.className = 'cards-audience-card';

    const cells = [...row.children];
    const imageCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim());
    const body = document.createElement('div');
    body.className = 'cards-audience-card-body';
    cells.filter((c) => c !== imageCell).forEach((c) => {
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
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 900px)', width: '1200' }, { width: '750' }]));
  });

  block.replaceChildren(ul);
}
