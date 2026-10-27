import { createOptimizedPicture } from '../../scripts/aem.js';
import { claimDecoration, contentRoot, replacePicture } from '../../scripts/ue-utils.js';

// the image column is ~600px wide on desktop and the content width on phones
const IMAGE_BREAKPOINTS = [{ width: '750' }];

/*
 * Columns (app)
 *
 * One row, two cells (order may be swapped by the author):
 *   text cell : H2 + intro paragraph(s), then one group per download tile:
 *               H3 + paragraph(s) + link (e.g. Android, Apple)
 *   image cell: picture only
 *
 * Each H3 group is wrapped in div.columns-app-tile inside div.columns-app-tiles.
 * Universal Editor: cells keep their instrumentation; the tiles are built inside the
 * cell's editable text (contentRoot).
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
  if (!claimDecoration(block)) return;
  [...block.children].forEach((row) => {
    row.classList.add('columns-app-row');
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic && !col.textContent.trim()) {
        col.classList.add('columns-app-img-col');
        const img = pic.querySelector('img');
        if (img?.getAttribute('src')) replacePicture(pic, createOptimizedPicture(img.src, img.alt, false, IMAGE_BREAKPOINTS));
      } else {
        col.classList.add('columns-app-text-col');
        groupTiles(contentRoot(col));
      }
    });
  });
}
