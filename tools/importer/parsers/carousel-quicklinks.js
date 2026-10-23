/* eslint-disable */
/* global WebImporter */

/**
 * Parser: carousel-quicklinks
 * Source: Elementor reviews/testimonial carousel (.elementor-element-b566fc0).
 *   .swiper-slide (duplicates skipped) > .elementor-testimonial
 *     > a.elementor-testimonial__header[href]
 *         > .elementor-testimonial__name (label) + .elementor-testimonial__icon (svg | img)
 *
 * Output rows (one per quick link):
 *   cell 1: icon <img> (SVG source) - empty when only an icon font is available
 *   cell 2: <p><a href>label</a></p>
 */

/** Build an <img> for an icon container: <img src> or inline <svg>; icon fonts are skipped. */
function iconImg(document, container) {
  if (!container) return null;
  const src = container.querySelector('img[src]');
  if (src && src.getAttribute('src')) {
    const img = document.createElement('img');
    img.src = src.getAttribute('src');
    img.alt = src.getAttribute('alt') || '';
    return img;
  }
  const svg = container.querySelector('svg');
  if (svg) {
    let markup = svg.outerHTML;
    if (!/xmlns=/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = document.createElement('img');
    try {
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
    } catch (e) {
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    }
    img.alt = '';
    return img;
  }
  return null;
}

export default function parse(element, { document }) {
  const cells = [];
  const seen = new Set();

  let slides = [...element.querySelectorAll('.swiper-slide')]
    .filter((s) => !s.classList.contains('swiper-slide-duplicate'));
  if (!slides.length) slides = [...element.querySelectorAll('.elementor-testimonial')];

  slides.forEach((slide) => {
    const item = slide.querySelector('.elementor-testimonial') || slide;
    // de-duplicate by repeater item id (loop clones without the duplicate class)
    const repeater = [...item.classList].find((c) => c.startsWith('elementor-repeater-item-'));
    const link = item.querySelector('a[href]');
    const nameEl = item.querySelector('.elementor-testimonial__name, .elementor-testimonial__cite, .elementor-testimonial__title');
    const label = ((nameEl || link || item).textContent || '').replace(/\s+/g, ' ').trim();
    if (!label) return;
    const key = repeater || `${label}|${link ? link.getAttribute('href') : ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    const icon = iconImg(document, item.querySelector('.elementor-testimonial__icon, .elementor-testimonial__image'));

    const p = document.createElement('p');
    if (link) {
      const a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = label;
      p.append(a);
    } else {
      p.textContent = label;
    }
    cells.push([icon || '', p]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-quicklinks', cells });
  element.replaceWith(block);
}
