/* eslint-disable */
/* global WebImporter */

/**
 * Parser: hero-service
 * Source: Elementor hero container .elementor-element-b72699d (servico template),
 * inside the #topo parent container (.elementor-element-3091f6a) that carries the
 * background photo as a CSS background image (captured as data-bg-src by the
 * cleanup transformer).
 *   .elementor-element-2d7c9d9 : three heading widgets (H2) + "VER PLANOS" button
 *   .elementor-element-485b87a : desktop-only images (product logo, price seal)
 *   .elementor-element-9086472 : mobile-only duplicate of the images (ignored,
 *                                only used to borrow a missing alt text)
 *
 * Output (one column):
 *   row 1: background <img>
 *   row 2: <h1>first heading</h1> <p>heading 2</p> <p>heading 3</p> <p><a>CTA</a></p>
 *   row 3: aside <img> logo + <img> price seal
 */

const urlOf = (value) => {
  const m = (value || '').match(/url\((['"]?)(.*?)\1\)/i);
  return m && m[2] && !m[2].startsWith('data:') ? m[2] : null;
};

/**
 * Resolve a CSS background image for an element: data-bg-src (set by the
 * cleanup transformer), inline style, data-settings, stylesheet rules, computed style.
 */
function bgSrc(el) {
  if (!el || !el.getAttribute) return null;
  if (el.getAttribute('data-bg-src')) return el.getAttribute('data-bg-src');
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

/** Background photo: the hero container itself or its ancestors up to the parent section. */
function findBackground(element) {
  let el = element;
  while (el && el.nodeType === 1 && el.tagName !== 'BODY') {
    const src = bgSrc(el);
    if (src) {
      // The photo now lives in the block; stop later background rules from emitting it again.
      el.removeAttribute('data-bg-src');
      el.style.setProperty('background-image', 'none', 'important');
      return src;
    }
    if (el.classList.contains('e-parent') || el.id === 'topo') break;
    el = el.parentElement;
  }
  return null;
}

/** Copy inline content (text, <br>, emphasis, links), unwrapping spans/divs. */
function copyInline(document, src, target) {
  src.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      const t = n.textContent.replace(/\s+/g, ' ');
      if (t.trim() || (target.lastChild && target.lastChild.nodeName !== 'BR')) {
        target.append(document.createTextNode(t));
      }
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'BR') {
      // drop trailing whitespace before the line break
      if (target.lastChild && target.lastChild.nodeType === 3) {
        target.lastChild.textContent = target.lastChild.textContent.replace(/\s+$/, '');
      }
      target.append(document.createElement('br'));
      return;
    }
    if (['STRONG', 'B', 'EM', 'I'].includes(tag)) {
      if (!n.textContent.trim()) return;
      const el = document.createElement(tag.toLowerCase());
      copyInline(document, n, el);
      target.append(el);
      return;
    }
    copyInline(document, n, target);
  });
}

function trimNode(el) {
  while (el.firstChild && ((el.firstChild.nodeType === 3 && !el.firstChild.textContent.trim()) || el.firstChild.nodeName === 'BR')) el.firstChild.remove();
  while (el.lastChild && ((el.lastChild.nodeType === 3 && !el.lastChild.textContent.trim()) || el.lastChild.nodeName === 'BR')) el.lastChild.remove();
  if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = el.firstChild.textContent.replace(/^\s+/, '');
  if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = el.lastChild.textContent.replace(/\s+$/, '');
  el.querySelectorAll('br').forEach((br) => {
    const next = br.nextSibling;
    if (next && next.nodeType === 3) next.textContent = next.textContent.replace(/^\s+/, '');
  });
  return el;
}

const isMobileOnly = (el) => !!el.closest('.elementor-hidden-desktop');

export default function parse(element, { document }) {
  const cells = [];

  // Row 1: background photo
  const bg = findBackground(element);
  if (bg) {
    const img = document.createElement('img');
    img.src = bg;
    img.alt = '';
    cells.push([[img]]);
  }

  // Row 2: headings + CTA (desktop/shared text container only)
  const content = [];
  const headings = [...element.querySelectorAll('.elementor-widget-heading')]
    .filter((w) => !isMobileOnly(w))
    .map((w) => w.querySelector('h1, h2, h3, h4, h5, h6') || w)
    .filter((h) => h.textContent.trim());
  headings.forEach((h, i) => {
    const el = document.createElement(i === 0 ? 'h1' : 'p');
    copyInline(document, h, el);
    trimNode(el);
    if (el.textContent.trim()) content.push(el);
  });
  const btn = [...element.querySelectorAll('.elementor-widget-button a[href]')].find((a) => !isMobileOnly(a));
  if (btn) {
    const label = ((btn.querySelector('.elementor-button-text') || btn).textContent || '').replace(/\s+/g, ' ').trim();
    if (label) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = btn.getAttribute('href');
      a.textContent = label;
      p.append(a);
      content.push(p);
    }
  }
  if (content.length) cells.push([content]);

  // Row 3: aside images from the desktop container (fallback: image-only, non-mobile containers)
  let desktop = element.querySelector('.elementor-element-485b87a');
  if (!desktop) {
    desktop = [...element.querySelectorAll(':scope > .e-con')]
      .find((c) => !c.classList.contains('elementor-hidden-desktop') && !c.textContent.trim() && c.querySelector('img'));
  }
  const mobileImgs = [...element.querySelectorAll('.elementor-hidden-desktop img')];
  if (desktop) {
    const aside = [];
    [...desktop.querySelectorAll('img[src]')].forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src.getAttribute('src');
      img.alt = src.getAttribute('alt') || (mobileImgs[i] && mobileImgs[i].getAttribute('alt')) || '';
      aside.push(img);
    });
    if (aside.length) cells.push([aside]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-service', cells });
  element.replaceWith(block);
}
