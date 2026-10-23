/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-app
 * Source: Elementor container .elementor-element-db01c2f ("Aplicativo Copel").
 *   text area : heading widget (H2) + text-editor, then two .boxApps containers
 *               (icon font + heading + text + button)
 *   image area: empty container whose photo is a CSS background image
 *
 * Output: one row, two cells
 *   cell 1: H2, intro paragraphs, per download tile H3 + paragraph + link
 *   cell 2: <img> built from the container background image
 */

const urlOf = (value) => {
  const m = (value || '').match(/url\((['"]?)(.*?)\1\)/i);
  return m && m[2] && !m[2].startsWith('data:') ? m[2] : null;
};

/**
 * Resolve a CSS background image for an element: data-bg-src (set by the
 * cleanup transformer), child <img>, inline style, data-settings, stylesheet
 * rules, computed style.
 */
function bgSrc(el) {
  if (!el) return null;
  if (el.getAttribute('data-bg-src')) return el.getAttribute('data-bg-src');
  const img = el.querySelector(':scope > img');
  if (img && img.getAttribute('src')) return img.getAttribute('src');
  const inline = urlOf(el.getAttribute('style'));
  if (inline) return inline;
  try {
    const settings = JSON.parse(el.getAttribute('data-settings') || '{}');
    if (settings.background_image && settings.background_image.url) return settings.background_image.url;
  } catch (e) { /* ignore */ }
  const doc = el.ownerDocument;
  let found = null;
  const scan = (rules) => {
    [...rules].forEach((r) => {
      if (r.cssRules && !r.selectorText) { scan(r.cssRules); return; }
      if (!r.selectorText || !r.style) return;
      const u = urlOf(r.style.backgroundImage);
      if (!u) return;
      try { if (el.matches(r.selectorText)) found = u; } catch (e) { /* ignore */ }
    });
  };
  [...(doc.styleSheets || [])].forEach((s) => {
    try { if (s.cssRules) scan(s.cssRules); } catch (e) { /* cross-origin */ }
  });
  if (found) return found;
  try {
    const view = doc.defaultView;
    if (view && view.getComputedStyle) return urlOf(view.getComputedStyle(el).backgroundImage);
  } catch (e) { /* ignore */ }
  return null;
}

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function findImage(element) {
  const containers = [...element.querySelectorAll('.e-con, .elementor-column, .elementor-widget-image')];
  for (const c of containers) {
    if (clean(c.textContent)) continue;
    const imgEl = c.querySelector('img[src]');
    const src = bgSrc(c) || (imgEl && imgEl.getAttribute('src'));
    if (src) return { src, alt: (imgEl && imgEl.getAttribute('alt')) || '' };
  }
  return null;
}

export default function parse(element, { document }) {
  const textCell = [];

  // Walk content widgets in document order.
  const widgets = [...element.querySelectorAll('.elementor-widget-heading, .elementor-widget-text-editor, .elementor-widget-button')];
  widgets.forEach((w) => {
    const inTile = !!w.closest('.boxApps');
    if (w.classList.contains('elementor-widget-heading')) {
      const src = w.querySelector('h1, h2, h3, h4, h5, h6') || w;
      const text = clean(src.textContent);
      if (!text) return;
      const h = document.createElement(inTile ? 'h3' : 'h2');
      h.textContent = text;
      textCell.push(h);
    } else if (w.classList.contains('elementor-widget-text-editor')) {
      const container = w.querySelector('.elementor-widget-container') || w;
      const blocks = [...container.querySelectorAll('p, ul, ol')].filter((b) => !b.parentElement.closest('p, ul, ol'));
      if (blocks.length) {
        blocks.forEach((b) => { if (clean(b.textContent)) textCell.push(b); });
      } else if (clean(container.textContent)) {
        const p = document.createElement('p');
        p.textContent = clean(container.textContent);
        textCell.push(p);
      }
    } else {
      const a = w.querySelector('a[href]');
      if (!a) return;
      const label = clean((a.querySelector('.elementor-button-text') || a).textContent);
      if (!label) return;
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = label;
      p.append(link);
      textCell.push(p);
    }
  });

  const imageInfo = findImage(element);
  let imageCell = '';
  if (imageInfo) {
    const img = document.createElement('img');
    img.src = imageInfo.src;
    img.alt = imageInfo.alt || 'Aplicativo Copel';
    imageCell = [img];
  }

  const cells = [[textCell.length ? textCell : '', imageCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-app', cells });
  element.replaceWith(block);
}
