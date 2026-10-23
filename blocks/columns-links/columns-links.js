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
 */

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
  if (!cell.textContent.trim()) return null;
  const col = document.createElement('div');
  col.className = 'columns-links-col';

  const heading = cell.querySelector(HEADING_SELECTOR);
  if (heading) {
    cleanHeading(heading);
    col.append(heading);
  } else {
    col.classList.add('columns-links-col-no-title');
  }

  const list = buildList(cell);
  if (list.children.length) col.append(list);
  return col.children.length ? col : null;
}

export default function decorate(block) {
  const cells = [...block.children].flatMap((row) => [...row.children]);
  const cols = cells.map(buildColumn).filter(Boolean);

  block.replaceChildren(...cols);
  // desktop columns per row: one per cell, max 5 (extra cells wrap)
  block.style.setProperty('--columns-links-count', Math.min(Math.max(cols.length, 1), 5));
  if (!block.querySelector('.columns-links-title')) block.classList.add('columns-links-no-titles');
}
