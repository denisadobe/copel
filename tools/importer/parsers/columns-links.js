/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-links
 * Source: Elementor section .elementor-element-a75d5f3 (copel.com home link
 * directory above the footer): 5 top-level columns, each with a heading
 * widget (h4, Elementor <br> alignment hack), a divider widget and an
 * icon-list widget of links.
 *
 * Output: one row, one cell per non-empty column:
 *   <h3>[<a>]title[</a>]</h3> + <ul><li><a href>label</a></li>...</ul>
 */

const ORIGIN = 'https://www.copel.com';
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function absolute(href) {
  if (!href) return href;
  try {
    return new URL(href, `${ORIGIN}/site/`).href;
  } catch (e) {
    return href;
  }
}

function topColumns(element) {
  let cols = [...element.querySelectorAll(':scope > .elementor-container > .elementor-column')];
  if (!cols.length) {
    cols = [...element.querySelectorAll('.elementor-column')]
      .filter((c) => !c.parentElement.closest('.elementor-column'));
  }
  return cols;
}

/** Copy heading inline content, dropping icons; keep mid-title <br>, strip edge <br>s. */
function appendInline(document, target, source) {
  source.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      target.append(document.createTextNode(n.textContent.replace(/\s+/g, ' ')));
    } else if (n.nodeType === 1) {
      const tag = n.tagName;
      if (tag === 'BR') target.append(document.createElement('br'));
      else if (tag === 'SVG' || tag === 'I' || tag === 'svg' || tag === 'IMG') {
        // skip icon markup
      } else appendInline(document, target, n);
    }
  });
}

function trimBreaks(el) {
  const isJunk = (n) => n && ((n.nodeType === 3 && !n.textContent.trim())
    || (n.nodeType === 1 && n.tagName === 'BR'));
  while (isJunk(el.lastChild)) el.lastChild.remove();
  while (isJunk(el.firstChild)) el.firstChild.remove();
  // tidy whitespace around remaining nodes
  if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = el.firstChild.textContent.replace(/^\s+/, '');
  if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = el.lastChild.textContent.replace(/\s+$/, '');
}

function buildHeading(document, col) {
  const src = col.querySelector('.elementor-widget-heading .elementor-heading-title')
    || col.querySelector('.elementor-widget-heading h1, .elementor-widget-heading h2, .elementor-widget-heading h3, .elementor-widget-heading h4, .elementor-widget-heading h5, .elementor-widget-heading h6');
  if (!src || !clean(src.textContent)) return null;
  const h3 = document.createElement('h3');
  const link = src.tagName === 'A' ? src : src.querySelector('a[href]');
  let target = h3;
  if (link && link.getAttribute('href')) {
    const a = document.createElement('a');
    a.href = absolute(link.getAttribute('href'));
    h3.append(a);
    target = a;
  }
  appendInline(document, target, link && link !== src ? link : src);
  trimBreaks(target);
  return h3;
}

function buildList(document, col) {
  const ul = document.createElement('ul');
  col.querySelectorAll('.elementor-widget-icon-list .elementor-icon-list-item').forEach((item) => {
    const textEl = item.querySelector('.elementor-icon-list-text') || item;
    const label = clean(textEl.textContent);
    if (!label) return;
    const li = document.createElement('li');
    const srcA = item.querySelector('a[href]');
    if (srcA) {
      const a = document.createElement('a');
      a.href = absolute(srcA.getAttribute('href'));
      a.textContent = label;
      li.append(a);
    } else {
      li.textContent = label;
    }
    ul.append(li);
  });
  return ul.children.length ? ul : null;
}

export default function parse(element, { document }) {
  const row = [];
  topColumns(element).forEach((col) => {
    if (!clean(col.textContent)) return;
    const cell = [];
    const h = buildHeading(document, col);
    if (h) cell.push(h);
    const ul = buildList(document, col);
    if (ul) cell.push(ul);
    if (cell.length) row.push(cell);
  });

  const cells = [row];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-links', cells });
  element.replaceWith(block);
}
