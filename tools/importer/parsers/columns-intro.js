/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-intro
 * Source: Elementor container .elementor-element-7a475ea (servico intro
 * "Protecao para sua casa, sossego para voce"):
 *   .elementor-element-ddd2142 : text-editor paragraph + product logo image
 *   .elementor-element-a62d6b6 : desktop-only illustration image
 * plus an image-only sibling container outside the block element in the same
 * parent section (.elementor-element-0a0a99f, photo of a woman receiving a
 * technician), which is pulled into the block as the last column and removed.
 *
 * Output: one row - [text + logo] [image] [image]
 */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const imageOnly = (el) => !clean(el.textContent) && !!el.querySelector('img[src]');

function imgFrom(document, src) {
  const img = document.createElement('img');
  img.src = src.getAttribute('src');
  img.alt = src.getAttribute('alt') || '';
  return img;
}

function textCell(document, container) {
  const out = [];
  container.querySelectorAll('.elementor-widget').forEach((w) => {
    if (w.classList.contains('elementor-widget-image')) {
      const src = w.querySelector('img[src]');
      if (src) out.push(imgFrom(document, src));
      return;
    }
    if (w.classList.contains('elementor-widget-heading')) {
      const h = w.querySelector('h1, h2, h3, h4, h5, h6');
      if (h && clean(h.textContent)) {
        const n = document.createElement(h.tagName.toLowerCase());
        n.textContent = clean(h.textContent);
        out.push(n);
      }
      return;
    }
    if (w.classList.contains('elementor-widget-button')) {
      const a = w.querySelector('a[href]');
      const label = a && clean((a.querySelector('.elementor-button-text') || a).textContent);
      if (label) {
        const p = document.createElement('p');
        const link = document.createElement('a');
        link.href = a.getAttribute('href');
        link.textContent = label;
        p.append(link);
        out.push(p);
      }
      return;
    }
    const root = w.querySelector('.elementor-widget-container') || w;
    const blocks = [...root.querySelectorAll('p, ul, ol')].filter((b) => !b.parentElement.closest('p, ul, ol'));
    if (blocks.length) {
      blocks.forEach((b) => { if (clean(b.textContent)) out.push(b); });
    } else if (clean(root.textContent)) {
      const p = document.createElement('p');
      p.textContent = clean(root.textContent);
      out.push(p);
    }
  });
  return out;
}

/** Image-only .e-con siblings of the element (or its ancestors) inside the same parent section. */
function siblingImageContainers(element) {
  const section = element.closest('.e-parent');
  if (!section || section === element) return [];
  const found = [];
  let anc = element;
  while (anc && anc !== section) {
    const parent = anc.parentElement;
    if (!parent) break;
    [...parent.children].forEach((sib) => {
      if (sib === anc || !sib.classList.contains('e-con')) return;
      if (sib.contains(element) || !imageOnly(sib)) return;
      found.push(sib);
    });
    anc = parent;
  }
  // eslint-disable-next-line no-bitwise
  return found.sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
}

export default function parse(element, { document }) {
  let cols = [...element.querySelectorAll(':scope > .e-con')];
  if (!cols.length) cols = [...element.children];

  const row = [];
  cols.forEach((col) => {
    if (imageOnly(col)) {
      const imgs = [...col.querySelectorAll('img[src]')].map((src) => imgFrom(document, src));
      if (imgs.length) row.push(imgs);
    } else if (clean(col.textContent)) {
      const text = textCell(document, col);
      if (text.length) row.push(text);
    }
  });

  const extras = siblingImageContainers(element);
  extras.forEach((c) => {
    const imgs = [...c.querySelectorAll('img[src]')].map((src) => imgFrom(document, src));
    if (imgs.length) row.push(imgs);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-intro', cells: [row] });
  element.replaceWith(block);
  extras.forEach((c) => { if (c.isConnected) c.remove(); });
}
