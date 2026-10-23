/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-audience
 * Source: Elementor container .elementor-element-caea78d with two child
 * containers (.iconCasaEmpresa) whose photos are CSS background images:
 *   heading widget (H2) + text-editor (ul of links) + icon-list (CTA link)
 *
 * Output rows (one per audience tile):
 *   cell 1: <img> from the tile background image
 *   cell 2: <h2>title</h2> <ul><li><a>…</a></li>…</ul> <p><a>CTA</a></p>
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

function link(document, a, label) {
  const el = document.createElement('a');
  el.href = a.getAttribute('href');
  el.textContent = label;
  return el;
}

export default function parse(element, { document }) {
  const cells = [];

  let cards = [...element.querySelectorAll(':scope > .e-con, :scope > .elementor-container > .elementor-column')];
  if (!cards.length) cards = [...element.querySelectorAll('.iconCasaEmpresa')];

  cards.forEach((card) => {
    const body = [];

    const headingEl = card.querySelector('.elementor-widget-heading h1, .elementor-widget-heading h2, .elementor-widget-heading h3, .elementor-widget-heading h4');
    const title = clean(headingEl && headingEl.textContent);
    if (title) {
      const h2 = document.createElement('h2');
      h2.textContent = title;
      body.push(h2);
    }

    // Quick links list (text-editor widget)
    card.querySelectorAll('.elementor-widget-text-editor').forEach((w) => {
      const links = [...w.querySelectorAll('a[href]')];
      if (links.length) {
        const ul = document.createElement('ul');
        links.forEach((a) => {
          const label = clean(a.textContent);
          if (!label) return;
          const li = document.createElement('li');
          li.append(link(document, a, label));
          ul.append(li);
        });
        if (ul.children.length) body.push(ul);
      } else {
        w.querySelectorAll('p').forEach((p) => { if (clean(p.textContent)) body.push(p); });
      }
    });

    // CTA (icon-list / button widgets)
    card.querySelectorAll('.elementor-widget-icon-list a[href], .elementor-widget-button a[href]').forEach((a) => {
      const label = clean((a.querySelector('.elementor-icon-list-text, .elementor-button-text') || a).textContent);
      if (!label) return;
      const p = document.createElement('p');
      p.append(link(document, a, label));
      body.push(p);
    });

    const src = bgSrc(card);
    let imageCell = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = title || '';
      imageCell = [img];
    }

    if (!body.length && !imageCell) return;
    cells.push([imageCell, body.length ? body : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-audience', cells });
  element.replaceWith(block);
}
