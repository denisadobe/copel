/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-steps
 * Source: Elementor container .elementor-element-2ee91eb ("Contratacao simples"):
 * three icon-box widgets (icon SVG, H3 title, description) separated by
 * decorative arrow icon widgets (.elementor-widget-icon, ignored).
 *
 * Output rows (one per step):
 *   cell 1: icon <img> (inline <svg> serialised to a data: URI when needed)
 *   cell 2: <h3>title</h3> <p>description</p>
 */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function svgToImg(document, svg, alt) {
  const clone = svg.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = clone.outerHTML;
  let data;
  try {
    data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  } catch (e) {
    data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }
  const img = document.createElement('img');
  img.src = data;
  img.alt = alt || '';
  return img;
}

function iconCell(document, box, title) {
  const holder = box.querySelector('.elementor-icon-box-icon') || box;
  const src = holder.querySelector('img[src]');
  if (src) {
    const img = document.createElement('img');
    img.src = src.getAttribute('src');
    const alt = src.getAttribute('alt');
    img.alt = alt && alt !== 'null' ? alt : '';
    return [img];
  }
  const svg = holder.querySelector('svg');
  if (svg) return [svgToImg(document, svg, '')];
  return [];
}

export default function parse(element, { document }) {
  const cells = [];
  let boxes = [...element.querySelectorAll('.elementor-widget-icon-box')];
  if (!boxes.length) boxes = [...element.querySelectorAll('.elementor-icon-box-wrapper')];

  boxes.forEach((box) => {
    const titleEl = box.querySelector('.elementor-icon-box-title') || box.querySelector('h1, h2, h3, h4, h5, h6');
    const title = clean(titleEl && titleEl.textContent);
    const descEl = box.querySelector('.elementor-icon-box-description');
    const desc = clean(descEl && descEl.textContent);

    const body = [];
    if (title) {
      const h3 = document.createElement('h3');
      const link = titleEl.querySelector('a[href]');
      if (link) {
        const a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.textContent = title;
        h3.append(a);
      } else {
        h3.textContent = title;
      }
      body.push(h3);
    }
    if (desc) {
      const p = document.createElement('p');
      p.textContent = desc;
      body.push(p);
    }

    const icon = iconCell(document, box, title);
    if (!icon.length && !body.length) return;
    cells.push([icon.length ? icon : '', body.length ? body : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-steps', cells });
  element.replaceWith(block);
}
