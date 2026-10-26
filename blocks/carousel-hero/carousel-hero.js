import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  IS_UE, claimDecoration, isEmptyRow, moveInstrumentation,
} from '../../scripts/ue-utils.js';

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
 *
 * Headless source (optional): leading "key | value" config rows, in any order
 *   Fonte / Source           banner list URL (AEM persisted query or app proxy), a
 *                            channel ("site"/"app", uses config.json "aem-banners-url")
 *                            or a persisted-query path on "aem-publish-url";
 *                            empty = authored slides only
 *   Público / Audience       overrides the detected audience (publicoAtual)
 *   Escopo Target / Target scope   Adobe Target decision scope (alloy)
 * are removed; with a Fonte, slides then come from banner Content Fragments
 * (carousel-hero-cf.js) and the remaining authored rows are the fallback.
 * Keys are matched case-, accent-, space- and dash-insensitively, so the Universal Editor
 * field names (fonte, publico, escopoTarget) work as keys too.
 *
 * Universal Editor (IS_UE): the authored slides are always shown (Content Fragments are
 * never fetched, so authors see and edit the fallback), a badge tells that the live site
 * uses Content Fragments, autoplay is off and empty (just added) slides are kept.
 */

const AUTOPLAY_MS = 6000;

const BADGE_TEXT = 'Conteúdo de Content Fragments do AEM (fallback autorado abaixo)';

// keys after normalizeKey (accents, case, spaces, dashes and a trailing colon removed)
const CONFIG_KEYS = {
  fonte: 'source',
  source: 'source',
  publico: 'audience',
  audience: 'audience',
  escopotarget: 'targetScope',
  targetscope: 'targetScope',
};

const normalizeKey = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

function readConfigRow(row) {
  const cells = [...row.children];
  if (cells.length !== 2 || row.querySelector('picture, img, h1, h2, h3, h4, h5, h6')) return null;
  const key = CONFIG_KEYS[normalizeKey(cells[0].textContent)];
  if (!key) return null;
  const link = cells[1].querySelector('a[href]');
  return { key, value: (link ? link.getAttribute('href') : cells[1].textContent).trim() };
}

/**
 * Removes the leading config rows (any order; the first row must be one of them).
 * @returns {{source?: string, audience?: string, targetScope?: string}|null} their values,
 *   null when the block has no config rows
 */
function extractSourceConfig(rows) {
  const config = {};
  let count = 0;
  while (count < rows.length) {
    const entry = readConfigRow(rows[count]);
    if (!entry) break;
    if (!(entry.key in config)) config[entry.key] = entry.value;
    count += 1;
  }
  if (!count) return null;
  rows.splice(0, count).forEach((row) => row.remove());
  return config;
}

/** Editor-only note on blocks whose live slides come from Content Fragments. */
function addEditorBadge(block, source) {
  const badge = document.createElement('p');
  badge.className = 'carousel-hero-ue-badge';
  badge.textContent = BADGE_TEXT;
  badge.title = `Fonte: ${source}`;
  block.append(badge);
}

function getSlideCells(row) {
  const cells = [...row.children];
  let imageCell = cells.find((c) => c.querySelector('picture, img'));
  // positional fallback (a slide just added in the editor, no picture yet): [image | content]
  if (!imageCell && cells.length > 1 && !cells[0].textContent.trim()) [imageCell] = cells;
  let contentCell = cells.find((c) => c !== imageCell);
  // An image cell that also holds text acts as both.
  if (imageCell && !contentCell && imageCell.querySelector('h1, h2, h3, h4, h5, h6, p:not(:has(picture))')) {
    contentCell = imageCell;
    imageCell = null;
  }
  return { imageCell, contentCell };
}

/**
 * @param {Element} row authored (or Content Fragment generated) row
 * @param {number} index slide index
 * @param {boolean} [prebuilt] pictures are already final (Content Fragment images on the
 *   AEM publish / Dynamic Media host), keep them instead of re-optimizing
 */
function buildSlide(row, index, prebuilt = false) {
  const slide = document.createElement('li');
  moveInstrumentation(row, slide);
  slide.className = 'carousel-hero-slide';
  slide.dataset.slideIndex = index;
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');

  const { imageCell, contentCell } = getSlideCells(row);

  if (imageCell) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'carousel-hero-slide-image';
    const pictures = [...imageCell.querySelectorAll('picture')];
    moveInstrumentation(imageCell, imageWrap);
    pictures.forEach((pic, i) => {
      const img = pic.querySelector('img');
      if (!img || !img.getAttribute('src')) return;
      if (prebuilt) img.loading = index === 0 && i === 0 ? 'eager' : 'lazy';
      let optimized = pic;
      if (!prebuilt) {
        optimized = createOptimizedPicture(
          img.src,
          img.alt || '',
          index === 0 && i === 0,
          [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
        );
        moveInstrumentation(pic, optimized);
        moveInstrumentation(img, optimized.querySelector('img'));
      }
      if (pictures.length > 1) optimized.classList.add(i === 0 ? 'carousel-hero-desktop' : 'carousel-hero-mobile');
      imageWrap.append(optimized);
    });
    if (imageWrap.children.length || IS_UE) slide.append(imageWrap);
  }

  if (contentCell && contentCell !== imageCell) {
    const content = document.createElement('div');
    moveInstrumentation(contentCell, content);
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

    if (content.textContent.trim() || content.children.length || IS_UE) slide.append(content);
  }

  return slide;
}

/**
 * Builds the carousel from slides; returns a teardown (timer + listeners) so the
 * slides can be swapped (authored fallback -> Content Fragments).
 */
function mount(block, slides) {
  // never in the editor: authors must be able to select and edit a slide
  const autoplay = !block.classList.contains('no-autoplay') && !IS_UE;

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.className = 'carousel-hero-slides';
  slidesWrapper.append(...slides);

  const container = document.createElement('div');
  container.className = 'carousel-hero-slides-container';
  container.append(slidesWrapper);
  block.replaceChildren(container);

  if (slides.length < 2) {
    slides[0].classList.add('active');
    return () => {};
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
  const listeners = new AbortController();
  const { signal } = listeners;

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
    if (signal.aborted || !autoplay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();
    timer = setInterval(() => {
      // a block removed from the page (e.g. re-rendered) must not keep a timer alive
      if (!block.isConnected) { listeners.abort(); stop(); return; }
      show(current + 1);
    }, AUTOPLAY_MS);
  }

  nav.querySelector('.carousel-hero-prev').addEventListener('click', () => { show(current - 1); start(); }, { signal });
  nav.querySelector('.carousel-hero-next').addEventListener('click', () => { show(current + 1); start(); }, { signal });
  indicators.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target-slide]');
    if (!btn) return;
    show(parseInt(btn.dataset.targetSlide, 10));
    start();
  }, { signal });
  block.addEventListener('mouseenter', stop, { signal });
  block.addEventListener('mouseleave', start, { signal });
  block.addEventListener('focusin', stop, { signal });
  block.addEventListener('focusout', start, { signal });
  // the editor (ue/scripts/ue.js) shows the slide the author selects
  block.addEventListener('carousel-hero:show', (e) => { show(e.detail.index); stop(); }, { signal });

  show(0);
  start();

  return () => {
    stop();
    listeners.abort();
  };
}

function showSkeleton(block) {
  const skeleton = document.createElement('div');
  skeleton.className = 'carousel-hero-skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  block.replaceChildren(skeleton);
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const rows = [...block.children].filter((row) => !isEmptyRow(row, 'picture, img'));
  const config = extractSourceConfig(rows);
  // Content Fragments only with a non-empty Fonte; in the editor the authored slides stay
  const source = config?.source ? config : null;
  const useCf = source && !IS_UE;
  if (!rows.length && !useCf && !IS_UE) return;

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');

  // authored slides render immediately (LCP); Content Fragments replace them when they arrive
  let teardown = rows.length ? mount(block, rows.map((row, i) => buildSlide(row, i))) : null;

  if (IS_UE) {
    if (!teardown) showSkeleton(block);
    if (source) addEditorBadge(block, source.source);
    return;
  }
  if (!useCf) return;

  if (!teardown) showSkeleton(block);
  block.setAttribute('aria-busy', 'true');
  import('./carousel-hero-cf.js')
    .then(({ default: loadBannerRows }) => loadBannerRows(source))
    .then((result) => {
      if (!result) throw new Error('no banners');
      const slides = result.rows.map(({ row, path }, i) => {
        const slide = buildSlide(row, i, true);
        if (path) slide.dataset.cfPath = path;
        return slide;
      });
      if (teardown) teardown();
      teardown = mount(block, slides);
      block.dataset.source = 'content-fragments';
      block.dataset.publico = result.audience;
      result.onDisplay();
    })
    .catch(() => {
      // keep the authored fallback; without one, drop the empty hero
      if (!teardown) {
        block.replaceChildren();
        block.hidden = true;
      }
    })
    .finally(() => block.removeAttribute('aria-busy'));
}
