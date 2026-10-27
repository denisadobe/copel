import { createOptimizedPicture } from '../../scripts/aem.js';
import { claimDecoration, contentRoot, replacePicture } from '../../scripts/ue-utils.js';

// the image column is ~600px wide on desktop and the content width on phones
const IMAGE_BREAKPOINTS = [{ width: '750' }];

/*
 * Columns (feature)
 *
 * One row (or more), two cells: image | text or text | image (author order is kept).
 *   image cell: picture only
 *   text cell : heading (H2/H3), paragraph(s), "Veja mais" link.
 *               When the text cell holds more than one heading, each heading
 *               and the content that follows it becomes a stacked panel
 *               (div.columns-feature-panel).
 *
 * Row classes added: columns-feature-image-first | columns-feature-image-last
 * (visual side of the image on wide screens).
 *
 * Options (block classes):
 *   dark:    ink-colored text panel with light text.
 *   reverse: mirrors the authored order on wide screens (image side swapped);
 *            on mobile the image stays on top.
 *
 * Universal Editor: cells keep their instrumentation; panels are built inside the cell's
 * editable text (contentRoot).
 */

function buildPanels(col) {
  const headings = [...col.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > h4')];
  // bare text (no element children) is kept as-is inside a single panel
  if (!col.children.length) {
    const p = document.createElement('div');
    p.className = 'columns-feature-panel';
    p.append(...col.childNodes);
    col.replaceChildren(p);
    return;
  }
  const panels = [];
  let panel = document.createElement('div');
  panel.className = 'columns-feature-panel';
  panels.push(panel);
  [...col.children].forEach((el) => {
    if (headings.includes(el) && panel.children.length) {
      panel = document.createElement('div');
      panel.className = 'columns-feature-panel';
      panels.push(panel);
    }
    panel.append(el);
  });
  col.replaceChildren(...panels.filter((p) => p.children.length));
  if (panels.length > 1) col.classList.add('columns-feature-panels');
}

function decorateMore(col) {
  col.querySelectorAll('p').forEach((p) => {
    const a = p.querySelector('a[href]');
    if (a && p.children.length === 1 && a.textContent.trim() === p.textContent.trim()) {
      p.classList.add('columns-feature-more');
      p.classList.remove('button-container');
      a.classList.remove('button', 'primary', 'secondary');
    }
  });
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const reverse = block.classList.contains('reverse');
  [...block.children].forEach((row) => {
    row.classList.add('columns-feature-row');
    const cols = [...row.children];
    let imageIndex = -1;
    cols.forEach((col, i) => {
      const pic = col.querySelector('picture');
      if (pic && !col.textContent.trim()) {
        col.classList.add('columns-feature-img-col');
        if (imageIndex < 0) imageIndex = i;
        col.querySelectorAll('picture > img').forEach((img) => {
          if (!img.getAttribute('src')) return;
          replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, IMAGE_BREAKPOINTS));
        });
      } else if (col.textContent.trim() || col.children.length) {
        col.classList.add('columns-feature-text-col');
        decorateMore(col);
        buildPanels(contentRoot(col));
      }
    });
    // row classes describe the visual side of the image on wide screens
    const imageFirst = reverse ? imageIndex > 0 : imageIndex === 0;
    if (imageIndex < 0) return;
    row.classList.add(imageFirst ? 'columns-feature-image-first' : 'columns-feature-image-last');
  });
}
