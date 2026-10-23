import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Columns (app)
 *
 * One row, two cells (order may be swapped by the author):
 *   text cell : H2 + intro paragraph(s), then one group per download tile:
 *               H3 + paragraph(s) + link (e.g. Android, Apple)
 *   image cell: picture only
 *
 * Each H3 group is wrapped in div.columns-app-tile inside div.columns-app-tiles.
 */

function groupTiles(col) {
  const headings = [...col.querySelectorAll(':scope > h3')];
  if (!headings.length) return;
  const tiles = document.createElement('div');
  tiles.className = 'columns-app-tiles';
  headings[0].before(tiles);

  let tile;
  let el = tiles.nextElementSibling;
  while (el) {
    const next = el.nextElementSibling;
    if (el.tagName === 'H3') {
      tile = document.createElement('div');
      tile.className = 'columns-app-tile';
      tiles.append(tile);
    }
    tile.append(el);
    el = next;
  }

  tiles.querySelectorAll('.columns-app-tile a[href]').forEach((a) => {
    a.classList.add('columns-app-tile-cta');
  });
}

export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('columns-app-row');
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic && !col.textContent.trim()) {
        col.classList.add('columns-app-img-col');
        const img = pic.querySelector('img');
        if (img) pic.replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 900px)', width: '1200' }, { width: '750' }]));
      } else {
        col.classList.add('columns-app-text-col');
        groupTiles(col);
      }
    });
  });
}
