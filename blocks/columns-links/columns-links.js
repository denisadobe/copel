/*
 * Columns (links) - link directory band above the global footer
 * (source: copel.com home, Elementor section a75d5f3).
 *
 * Authoring: one row, N cells (any count). Each cell:
 *   heading (H2-H6, may wrap a link) + list (UL/OL) of links.
 * Defensive rules:
 *   - empty cells are dropped; extra rows are flattened into the same grid
 *   - a cell without a heading still renders its list
 *   - links authored as paragraphs (no list) are collected into a list
 *   - trailing <br> / empty lines in headings (Elementor alignment hack) are removed
 *
 * Output per cell: div.columns-links-col > [h*.columns-links-title] + ul.columns-links-list
 *
 * Universal Editor: rows and cells keep their instrumentation (rows stay in the DOM as
 * div.columns-links-row with display: contents) and the title + list stay inside the cell's
 * editable text (contentRoot).
 */

import {
  IS_UE, claimDecoration, contentRoot, moveInstrumentation,
} from '../../scripts/ue-utils.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

function cleanHeading(heading) {
  // drop trailing <br> and whitespace-only nodes
  let last = heading.lastChild;
  while (last && ((last.nodeType === Node.TEXT_NODE && !last.textContent.trim())
    || (last.nodeType === Node.ELEMENT_NODE && last.tagName === 'BR'))) {
    last.remove();
    last = heading.lastChild;
  }
  heading.classList.add('columns-links-title');
}

function buildList(cell) {
  const lists = [...cell.querySelectorAll('ul, ol')];
  const list = document.createElement('ul');
  list.className = 'columns-links-list';

  if (lists.length) {
    lists.forEach((l) => {
      list.append(...[...l.children].filter((li) => li.textContent.trim()));
    });
    return list;
  }

  // fallback: links or text authored as paragraphs
  [...cell.querySelectorAll('p')].forEach((p) => {
    const links = [...p.querySelectorAll('a[href]')];
    if (links.length) {
      links.forEach((a) => {
        a.classList.remove('button', 'primary', 'secondary', 'accent');
        const li = document.createElement('li');
        li.append(a);
        list.append(li);
      });
    } else if (p.textContent.trim()) {
      const li = document.createElement('li');
      li.append(...p.childNodes);
      list.append(li);
    }
  });
  return list;
}

function buildColumn(cell) {
  if (!cell.textContent.trim() && !IS_UE) return null;
  const col = document.createElement('div');
  moveInstrumentation(cell, col);
  col.className = 'columns-links-col';

  // editor: title + list go back into the cell's editable text
  const root = contentRoot(cell);
  const target = root === cell ? col : root;
  const parts = [];

  const heading = root.querySelector(HEADING_SELECTOR);
  if (heading) {
    cleanHeading(heading);
    parts.push(heading);
  } else {
    col.classList.add('columns-links-col-no-title');
  }

  const list = buildList(root);
  if (list.children.length) parts.push(list);
  if (target === col) {
    col.append(...parts);
  } else {
    target.replaceChildren(...parts);
    col.append(target);
  }
  return parts.length || IS_UE ? col : null;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  let cols;
  if (IS_UE) {
    // keep the (instrumented) rows; they create no box, so the grid stays on the block
    [...block.children].forEach((row) => {
      row.classList.add('columns-links-row');
      row.replaceChildren(...[...row.children].map(buildColumn).filter(Boolean));
    });
    cols = [...block.querySelectorAll('.columns-links-col')];
  } else {
    cols = [...block.children].flatMap((row) => [...row.children]).map(buildColumn).filter(Boolean);
    block.replaceChildren(...cols);
  }
  // desktop columns per row: one per cell, max 5 (extra cells wrap)
  block.style.setProperty('--columns-links-count', Math.min(Math.max(cols.length, 1), 5));
  if (!block.querySelector('.columns-links-title')) block.classList.add('columns-links-no-titles');
}
