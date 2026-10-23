/* eslint-disable */
/* global WebImporter */

/**
 * Parser: carousel-coverage
 * Source: Elementor nested carousel (.elementor-widget-n-carousel, swiper)
 * .elementor-element-6ae60bb in #coberturas. Each real slide (swiper loop
 * duplicates skipped, deduped by title) holds:
 *   image widget (coverage photo)
 *   button widgets "Basico" / "Premium" -> #planos (plan tags)
 *   heading widget (coverage title)
 *   text-editor widget (description)
 *
 * Output rows (one per coverage):
 *   cell 1: <img>
 *   cell 2: <p><a>Basico</a> | <a>Premium</a></p> <h3>title</h3> <p>description</p>
 */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function getSlides(root) {
  const slides = [...root.querySelectorAll('.swiper-slide')]
    .filter((s) => !s.classList.contains('swiper-slide-duplicate'));
  if (slides.length) return slides;
  // not initialised by swiper: direct children of the carousel wrapper
  const wrapper = root.querySelector('.swiper-wrapper, .e-n-carousel');
  return wrapper ? [...wrapper.children] : [];
}

function buildRow(document, slide) {
  const imgSrc = slide.querySelector('.elementor-widget-image img[src]') || slide.querySelector('img[src]');
  const imageCell = [];
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc.getAttribute('src');
    img.alt = imgSrc.getAttribute('alt') || '';
    imageCell.push(img);
  }

  const body = [];
  const tags = [...slide.querySelectorAll('.elementor-widget-button a[href]')]
    .map((a) => ({ href: a.getAttribute('href'), label: clean((a.querySelector('.elementor-button-text') || a).textContent) }))
    .filter((t) => t.label);
  if (tags.length) {
    const p = document.createElement('p');
    tags.forEach((t, i) => {
      // non-space separator: html2md merges adjacent same-href links split only by whitespace
      if (i) p.append(document.createTextNode(' | '));
      const a = document.createElement('a');
      a.href = t.href;
      a.textContent = t.label;
      p.append(a);
    });
    body.push(p);
  }

  const heading = slide.querySelector('.elementor-widget-heading h1, .elementor-widget-heading h2, .elementor-widget-heading h3, .elementor-widget-heading h4, .elementor-widget-heading h5, .elementor-widget-heading h6');
  const title = clean(heading && heading.textContent);
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    body.push(h3);
  }

  slide.querySelectorAll('.elementor-widget-text-editor').forEach((w) => {
    const root = w.querySelector('.elementor-widget-container') || w;
    const blocks = [...root.querySelectorAll('p, ul, ol')].filter((b) => !b.parentElement.closest('p, ul, ol'));
    if (blocks.length) {
      blocks.forEach((b) => { if (clean(b.textContent)) body.push(b); });
    } else if (clean(root.textContent)) {
      const p = document.createElement('p');
      p.textContent = clean(root.textContent);
      body.push(p);
    }
  });

  return { title, imageCell, body };
}

export default function parse(element, { document }) {
  const cells = [];
  const seen = new Set();
  getSlides(element).forEach((slide) => {
    const { title, imageCell, body } = buildRow(document, slide);
    if (!imageCell.length && !body.length) return;
    const key = title || (imageCell[0] && imageCell[0].getAttribute('src'));
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    cells.push([imageCell.length ? imageCell : '', body.length ? body : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-coverage', cells });
  element.replaceWith(block);
}
