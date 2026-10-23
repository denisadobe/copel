/* eslint-disable */
/* global WebImporter */

/**
 * Parser: carousel-hero
 * Source: Elementor "slides" widget (.elementor-widget-slides.anunciosHome).
 * Desktop widget: .elementor-element-7fd830f6 (section hidden on mobile).
 * Mobile widget:  .elementor-element-8d7c84e  (section .elementor-hidden-desktop).
 *
 * Output rows (one per slide, swiper duplicates skipped):
 *   cell 1: desktop banner <img> [+ matching mobile banner <img>]
 *   cell 2: <h2>title</h2> <p>summary</p>* <p><a>CTA</a></p>{1,2}
 *
 * When the desktop widget is parsed, matching mobile slides contribute their
 * image as the optional 2nd picture and the mobile widget is removed so the
 * page holds a single hero carousel.
 */

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function getSlides(root) {
  return [...root.querySelectorAll('.swiper-slide')]
    .filter((s) => !s.classList.contains('swiper-slide-duplicate'));
}

const urlOf = (value) => {
  const m = (value || '').match(/url\((['"]?)(.*?)\1\)/i);
  return m && m[2] && !m[2].startsWith('data:') ? m[2] : null;
};

/**
 * Resolve a CSS background image for an element: data-bg-src (set by the
 * cleanup transformer), child <img>, inline style, stylesheet rules, computed style.
 */
function bgSrc(el) {
  if (!el) return null;
  if (el.getAttribute('data-bg-src')) return el.getAttribute('data-bg-src');
  const img = el.querySelector(':scope > img');
  if (img && img.getAttribute('src')) return img.getAttribute('src');
  const inline = urlOf(el.getAttribute('style'));
  if (inline) return inline;
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

function slideImageSrc(slide) {
  const bg = slide.querySelector('.swiper-slide-bg');
  const src = bgSrc(bg);
  return src ? { src, alt: '' } : null;
}

function headingText(slide) {
  const h = slide.querySelector('.elementor-slide-heading');
  if (!h) return '';
  const clone = h.cloneNode(true);
  clone.querySelectorAll('img, picture, svg').forEach((n) => n.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  clone.querySelectorAll('div, p').forEach((d) => d.append(' '));
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function slideHref(slide) {
  const inner = slide.querySelector('a.swiper-slide-inner');
  return inner ? inner.getAttribute('href') : null;
}

function buildImg(document, info) {
  const img = document.createElement('img');
  img.src = info.src;
  img.alt = info.alt || '';
  return img;
}

/** Split description into paragraphs on runs of 2+ <br>; drop links (CTAs). */
function buildSummary(document, slide) {
  const desc = slide.querySelector('.elementor-slide-description');
  if (!desc) return [];
  const clone = desc.cloneNode(true);
  clone.querySelectorAll('a').forEach((a) => a.remove());
  const paras = [];
  let current = document.createElement('p');
  let brRun = 0;
  const flush = () => {
    if (current.textContent.trim()) {
      // trim leading/trailing whitespace-only text nodes
      paras.push(current);
    }
    current = document.createElement('p');
  };
  const walk = (nodes) => {
    nodes.forEach((n) => {
      if (n.nodeType === 1 && n.tagName === 'BR') {
        brRun += 1;
        return;
      }
      if (n.nodeType === 3 && !n.textContent.trim()) {
        if (current.childNodes.length) current.append(document.createTextNode(' '));
        return;
      }
      if (brRun >= 2) flush();
      else if (brRun === 1 && current.childNodes.length) current.append(document.createTextNode(' '));
      brRun = 0;
      if (n.nodeType === 1 && n.tagName === 'FONT') {
        walk([...n.childNodes]);
        return;
      }
      if (n.nodeType === 1 && (n.tagName === 'STRONG' || n.tagName === 'B' || n.tagName === 'EM' || n.tagName === 'I')) {
        const el = document.createElement(n.tagName.toLowerCase());
        el.textContent = n.textContent.replace(/\s+/g, ' ').trim();
        current.append(el);
        return;
      }
      current.append(document.createTextNode(n.textContent.replace(/\s+/g, ' ')));
    });
  };
  walk([...clone.childNodes]);
  flush();
  paras.forEach((p) => {
    // normalise whitespace in text nodes
    p.childNodes.forEach((c) => { if (c.nodeType === 3) c.textContent = c.textContent.replace(/\s+/g, ' '); });
    if (p.firstChild && p.firstChild.nodeType === 3) p.firstChild.textContent = p.firstChild.textContent.replace(/^\s+/, '');
    if (p.lastChild && p.lastChild.nodeType === 3) p.lastChild.textContent = p.lastChild.textContent.replace(/\s+$/, '');
  });
  return paras;
}

function buildCtas(document, slide) {
  const ctas = [];
  const descLinks = [...slide.querySelectorAll('.elementor-slide-description a[href]')];
  descLinks.slice(0, 2).forEach((a) => {
    const label = a.textContent.replace(/\s+/g, ' ').trim();
    if (!label) return;
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = label;
    ctas.push(link);
  });
  if (!ctas.length) {
    const href = slideHref(slide);
    const btn = slide.querySelector('.elementor-slide-button');
    const label = btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '';
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label || 'Saiba mais';
      ctas.push(link);
    }
  }
  return ctas.map((a) => {
    const p = document.createElement('p');
    p.append(a);
    return p;
  });
}

export default function parse(element, { document }) {
  const isMobileWidget = !!element.closest('.elementor-hidden-desktop');

  // Mobile slides (for the optional 2nd picture) when parsing the desktop widget.
  let mobileSlides = [];
  let mobileWidgets = [];
  if (!isMobileWidget) {
    mobileWidgets = [...document.querySelectorAll('.elementor-hidden-desktop .elementor-widget-slides.anunciosHome')]
      .filter((w) => w !== element && !element.contains(w));
    mobileWidgets.forEach((w) => { mobileSlides = mobileSlides.concat(getSlides(w)); });
  }

  const cells = [];
  getSlides(element).forEach((slide) => {
    const imageCell = [];
    const desktop = slideImageSrc(slide);
    if (desktop) imageCell.push(buildImg(document, desktop));

    const title = headingText(slide);
    if (mobileSlides.length && desktop) {
      const href = slideHref(slide);
      const match = mobileSlides.find((m) => title && norm(headingText(m)) === norm(title))
        || mobileSlides.find((m) => href && slideHref(m) === href);
      const mobile = match && slideImageSrc(match);
      if (mobile && mobile.src !== desktop.src) imageCell.push(buildImg(document, mobile));
    }

    const contentCell = [];
    if (title) {
      const h2 = document.createElement('h2');
      h2.textContent = title;
      contentCell.push(h2);
    }
    contentCell.push(...buildSummary(document, slide));
    contentCell.push(...buildCtas(document, slide));

    if (!imageCell.length && !contentCell.length) return;
    cells.push([imageCell.length ? imageCell : '', contentCell.length ? contentCell : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-hero', cells });
  element.replaceWith(block);

  // Desktop carousel already carries the mobile banners: drop the duplicate widget.
  mobileWidgets.forEach((w) => { if (w.isConnected) w.remove(); });
}
