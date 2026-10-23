import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Carousel (hero)
 *
 * Authored / generated structure (stable contract, mirrors the "banner"
 * Content Fragment model so the same markup can be produced from AEM
 * headless GraphQL data):
 *
 *   <div class="carousel-hero">
 *     <div>                                   <- one row per slide
 *       <div><picture>…</picture>[<picture>…</picture>]</div>  <- cell 1: image
 *                                             (1st = desktop, optional 2nd = mobile)
 *       <div>                                 <- cell 2: content
 *         <h2>title</h2>                      <- CF: title
 *         <p>summary</p>                      <- CF: summary (optional)
 *         <p><a href="ctaLink">ctaLabel</a></p>            <- CF: ctaLink/ctaLabel
 *         <p><a href="secondaryCtaLink">…</a></p>          <- CF: secondaryCtaLink/Label
 *       </div>
 *     </div>
 *   </div>
 *
 * Any cell may be missing; a single-cell row is treated as content if it has
 * no picture, otherwise as image. Options (block classes): "no-autoplay".
 */

const AUTOPLAY_MS = 6000;

function getSlideCells(row) {
  const cells = [...row.children];
  let imageCell = cells.find((c) => c.querySelector('picture, img'));
  let contentCell = cells.find((c) => c !== imageCell);
  // An image cell that also holds text acts as both.
  if (imageCell && !contentCell && imageCell.querySelector('h1, h2, h3, h4, h5, h6, p:not(:has(picture))')) {
    contentCell = imageCell;
    imageCell = null;
  }
  return { imageCell, contentCell };
}

function buildSlide(row, index) {
  const slide = document.createElement('li');
  slide.className = 'carousel-hero-slide';
  slide.dataset.slideIndex = index;
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');

  const { imageCell, contentCell } = getSlideCells(row);

  if (imageCell) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'carousel-hero-slide-image';
    const pictures = [...imageCell.querySelectorAll('picture')];
    pictures.forEach((pic, i) => {
      const img = pic.querySelector('img');
      if (!img) return;
      const optimized = createOptimizedPicture(
        img.src,
        img.alt || '',
        index === 0 && i === 0,
        [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
      );
      if (pictures.length > 1) optimized.classList.add(i === 0 ? 'carousel-hero-desktop' : 'carousel-hero-mobile');
      imageWrap.append(optimized);
    });
    if (imageWrap.children.length) slide.append(imageWrap);
  }

  if (contentCell && contentCell !== imageCell) {
    const content = document.createElement('div');
    content.className = 'carousel-hero-slide-content';
    while (contentCell.firstChild) content.append(contentCell.firstChild);
    // remove stray pictures in content cell (already handled as image)
    content.querySelectorAll('picture').forEach((p) => {
      const parent = p.parentElement;
      p.remove();
      const isEmpty = parent && !parent.textContent.trim() && !parent.children.length;
      if (isEmpty && parent !== content) parent.remove();
    });

    const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      heading.classList.add('carousel-hero-title');
      slide.setAttribute('aria-label', heading.textContent.trim());
    }

    const links = [...content.querySelectorAll('a[href]')];
    links.forEach((a, i) => {
      a.classList.add('button', 'carousel-hero-cta');
      if (i > 0) a.classList.add('carousel-hero-cta-secondary');
      const p = a.closest('p');
      if (p) p.classList.add('button-container');
    });
    // group CTA paragraphs into one container
    const ctaPs = [...content.querySelectorAll(':scope > p.button-container')];
    if (ctaPs.length) {
      const ctas = document.createElement('div');
      ctas.className = 'carousel-hero-ctas';
      ctaPs[0].before(ctas);
      ctaPs.forEach((p) => ctas.append(p));
    }

    if (content.textContent.trim() || content.children.length) slide.append(content);
  }

  return slide;
}

export default function decorate(block) {
  const rows = [...block.children].filter((r) => r.textContent.trim() || r.querySelector('picture, img'));
  if (!rows.length) return;

  const autoplay = !block.classList.contains('no-autoplay');
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.className = 'carousel-hero-slides';
  const slides = rows.map((row, i) => buildSlide(row, i));
  slidesWrapper.append(...slides);

  const container = document.createElement('div');
  container.className = 'carousel-hero-slides-container';
  container.append(slidesWrapper);
  block.replaceChildren(container);

  if (slides.length < 2) {
    slides[0].classList.add('active');
    return;
  }

  // indicators
  const indicators = document.createElement('ol');
  indicators.className = 'carousel-hero-indicators';
  slides.forEach((slide, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Slide ${i + 1} / ${slides.length}`);
    btn.dataset.targetSlide = i;
    li.append(btn);
    indicators.append(li);
  });

  // nav arrows
  const nav = document.createElement('div');
  nav.className = 'carousel-hero-navigation';
  nav.innerHTML = `
    <button type="button" class="carousel-hero-prev" aria-label="Previous slide"></button>
    <button type="button" class="carousel-hero-next" aria-label="Next slide"></button>`;
  container.append(nav);
  block.append(indicators);

  let current = 0;
  let timer;

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', !active);
      slide.querySelectorAll('a, button').forEach((el) => {
        if (active) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
    });
    [...indicators.querySelectorAll('button')].forEach((btn, i) => {
      if (i === current) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function stop() { clearInterval(timer); timer = null; }
  function start() {
    if (!autoplay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();
    timer = setInterval(() => show(current + 1), AUTOPLAY_MS);
  }

  nav.querySelector('.carousel-hero-prev').addEventListener('click', () => { show(current - 1); start(); });
  nav.querySelector('.carousel-hero-next').addEventListener('click', () => { show(current + 1); start(); });
  indicators.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target-slide]');
    if (!btn) return;
    show(parseInt(btn.dataset.targetSlide, 10));
    start();
  });
  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  block.addEventListener('focusin', stop);
  block.addEventListener('focusout', start);

  show(0);
  start();
}
