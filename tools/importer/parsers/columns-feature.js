/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-feature
 * Source: Elementor parent containers (A Copel, Sustentabilidade/Inovacao,
 * Educacao, Mercado livre, Carreira). Each has two child containers:
 *   image container: no text, photo is a CSS background image
 *   text container : heading widget(s) (H2/H3), text-editor, "Veja mais" button;
 *                    may hold several nested panels (Sustentabilidade/Inovacao)
 *
 * Output: one row, two cells in source order (image|text or text|image).
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

function buildText(document, container) {
  const out = [];
  const widgets = [...container.querySelectorAll('.elementor-widget-heading, .elementor-widget-text-editor, .elementor-widget-button')];
  widgets.forEach((w) => {
    if (w.classList.contains('elementor-widget-heading')) {
      const src = w.querySelector('h1, h2, h3, h4, h5, h6');
      const text = clean((src || w).textContent);
      if (!text) return;
      const h = document.createElement(src ? src.tagName.toLowerCase() : 'h3');
      h.textContent = text;
      out.push(h);
    } else if (w.classList.contains('elementor-widget-text-editor')) {
      const root = w.querySelector('.elementor-widget-container') || w;
      const blocks = [...root.querySelectorAll('p, ul, ol')].filter((b) => !b.parentElement.closest('p, ul, ol'));
      if (blocks.length) {
        blocks.forEach((b) => { if (clean(b.textContent)) out.push(b); });
      } else if (clean(root.textContent)) {
        const p = document.createElement('p');
        p.textContent = clean(root.textContent);
        out.push(p);
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
      out.push(p);
    }
  });
  return out;
}

export default function parse(element, { document }) {
  let cols = [...element.querySelectorAll(':scope > .e-con, :scope > .elementor-container > .elementor-column')];
  if (!cols.length) cols = [...element.children];

  const headingText = clean((element.querySelector('h1, h2, h3, h4, h5, h6') || {}).textContent);
  const row = [];
  cols.forEach((col) => {
    if (!clean(col.textContent)) {
      const imgEl = col.querySelector('img[src]');
      const src = bgSrc(col) || (imgEl && imgEl.getAttribute('src'));
      if (!src) return;
      const img = document.createElement('img');
      img.src = src;
      img.alt = (imgEl && imgEl.getAttribute('alt')) || headingText || '';
      row.push([img]);
    } else {
      const text = buildText(document, col);
      if (text.length) row.push(text);
    }
  });

  while (row.length < 2) row.push('');
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-feature', cells: [row] });
  element.replaceWith(block);
}
