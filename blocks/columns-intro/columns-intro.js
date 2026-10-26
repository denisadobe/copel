import { createOptimizedPicture } from '../../scripts/aem.js';
import { IS_UE, claimDecoration, replacePicture } from '../../scripts/ue-utils.js';

/*
 * Columns (intro)
 *
 * One row, any number of cells:
 *   text cell: paragraph(s) + optional logo image
 *   image cells: one photo each
 *
 * Cells are classified by content. Missing cells collapse the grid.
 */

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const rows = [...block.children];
  const maxCols = Math.max(0, ...rows.map((r) => r.children.length));
  block.classList.add(`columns-intro-${maxCols}-cols`);

  rows.forEach((row) => {
    row.classList.add('columns-intro-row');
    [...row.children].forEach((col) => {
      const hasText = !!col.textContent.trim();
      const pics = col.querySelectorAll('picture');
      if (!hasText && !pics.length) {
        // the editor keeps an empty (just added) cell so it stays selectable
        if (!IS_UE) col.remove();
        return;
      }
      if (!hasText) {
        col.classList.add('columns-intro-img-col');
        pics.forEach((pic) => {
          const img = pic.querySelector('img');
          if (!img?.getAttribute('src') || img.src.split('?')[0].endsWith('.svg')) return;
          replacePicture(pic, createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
        });
      } else {
        col.classList.add('columns-intro-text-col');
        pics.forEach((pic) => {
          const p = pic.closest('p');
          if (p && !p.textContent.trim()) p.classList.add('columns-intro-logo');
        });
      }
    });
  });

  if (!block.querySelector('.columns-intro-img-col')) block.classList.add('columns-intro-text-only');
}
