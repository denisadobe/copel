import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  IS_UE, claimDecoration, isEmptyRow, moveInstrumentation,
} from '../../scripts/ue-utils.js';
import { getStorefrontConfig } from '../../scripts/commerce-session.js';

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
 * Universal Editor (IS_UE): autoplay is off and empty (just added) slides are kept. With a
 * Fonte, the Content Fragment slides are rendered (same published source as the site) and
 * instrumented for the AEM connection (urn:aemconnection:<_path>/jcr:content/data/master,
 * type "reference", filter "cf"; props titulo, resumo, ctaTexto, imagem), so selecting a slide
 * edits the fragment in the properties panel and saves to AEM author. Each CF slide has an
 * "Editar no AEM" link to the Content Fragment editor. The authored fallback slides stay in the
 * DOM, hidden (and shown again when the fetch fails). The DA block instrumentation (urn:ab…,
 * fields Fonte / Público / Escopo Target) is untouched. Live updates: ue/scripts/ue.js.
 */

const AUTOPLAY_MS = 6000;
// same as carousel-hero-cf.js
const FETCH_TIMEOUT_MS = 4000;

const BADGE_CF = 'Banners de Content Fragments do AEM — clique no slide para editar no painel, ou use "Editar no AEM"';
const BADGE_LOADING = 'Carregando banners de Content Fragments do AEM…';
// how often the published banners are re-checked while the page is visible; the first check
// waits until the page has settled, so it never competes with loading (or page-speed audits)
const REFRESH_MS = 5000;
const FIRST_REFRESH_MS = 15000;
const BADGE_FAILED = 'Não foi possível carregar os Content Fragments do AEM: exibindo os slides autorados (fallback)';

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

/** Editor-only note on blocks whose slides come from Content Fragments (created or updated). */
function setEditorBadge(block, text, source) {
  const badge = block.querySelector(':scope > .carousel-hero-ue-badge') || document.createElement('p');
  badge.className = 'carousel-hero-ue-badge';
  badge.textContent = text;
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
  const slide = document.createElement('div');
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
      // lazy here; prioritizeFirstImage() makes the visible picture of the first slide eager
      if (prebuilt) img.loading = 'lazy';
      let optimized = pic;
      if (!prebuilt) {
        optimized = createOptimizedPicture(
          img.src,
          img.alt || '',
          false,
          [{ media: '(min-width: 1600px)', width: '2000' }, { media: '(min-width: 600px)', width: '1600' }, { width: '750' }],
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

/* ---------------------------------------------------------------------------------------- */
/* Image loading: the first slide's image is the page LCP                                    */
/* ---------------------------------------------------------------------------------------- */

const isDesktopHero = () => window.matchMedia('(width >= 768px)').matches;
const DEFERRED = ['srcset', 'src'];

/**
 * The picture of the first slide that this viewport shows (desktop / mobile variant, see the
 * CSS breakpoint) loads eagerly with high priority; the other variant stays lazy (not fetched
 * while hidden).
 * @returns {HTMLImageElement|null} the prioritized image
 */
function prioritizeFirstImage(slide) {
  const pictures = [...slide.querySelectorAll('.carousel-hero-slide-image picture')];
  const visible = pictures.find((pic) => pic.classList.contains(isDesktopHero() ? 'carousel-hero-desktop' : 'carousel-hero-mobile'))
    || pictures[0];
  const img = visible?.querySelector('img');
  if (!img) return null;
  img.loading = 'eager';
  img.fetchPriority = 'high';
  return img;
}

/** Holds back the image requests of a slide (srcset/src kept in data-defer-* attributes). */
function deferImages(slide) {
  slide.querySelectorAll('.carousel-hero-slide-image picture > source, .carousel-hero-slide-image picture > img')
    .forEach((el) => DEFERRED.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (!value) return;
      el.setAttribute(`data-defer-${attr}`, value);
      el.removeAttribute(attr);
    }));
}

function restoreImages(slide) {
  slide.querySelectorAll('[data-defer-src], [data-defer-srcset]')
    .forEach((el) => DEFERRED.forEach((attr) => {
      const value = el.getAttribute(`data-defer-${attr}`);
      if (!value) return;
      el.setAttribute(attr, value);
      el.removeAttribute(`data-defer-${attr}`);
    }));
}

/**
 * Site only (the editor loads every image as authored): the hero image first, the images of
 * the other slides (hidden until their turn) once it is done, so they don't compete with it.
 */
function scheduleImages(slides) {
  if (IS_UE) return;
  const hero = prioritizeFirstImage(slides[0]);
  if (slides.length < 2) return;
  slides.slice(1).forEach(deferImages);
  const release = () => slides.forEach(restoreImages);
  if (!hero || hero.complete) {
    setTimeout(release, 0);
    return;
  }
  hero.addEventListener('load', release, { once: true });
  hero.addEventListener('error', release, { once: true });
}

/**
 * Builds the carousel from slides; returns a teardown (timer + listeners) so the
 * slides can be swapped (authored fallback -> Content Fragments).
 */
function mount(block, slides, startIndex = 0) {
  // never in the editor: authors must be able to select and edit a slide
  const autoplay = !block.classList.contains('no-autoplay') && !IS_UE;

  // slides are a group of "slide" groups (role/roledescription below), not a list
  const slidesWrapper = document.createElement('div');
  slidesWrapper.className = 'carousel-hero-slides';
  slidesWrapper.append(...slides);

  const container = document.createElement('div');
  container.className = 'carousel-hero-slides-container';
  container.append(slidesWrapper);
  scheduleImages(slides);
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
    restoreImages(slides[current]);
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

  show(Math.min(startIndex, slides.length - 1));
  start();

  return () => {
    stop();
    listeners.abort();
  };
}

/**
 * Starts what the banner list needs right away, while carousel-hero-cf.js loads (the hero image,
 * the page LCP, waits for it): the request itself for an absolute Fonte URL (app proxy, AEM
 * publish), else the site config (/config.json, session cached) that resolves a channel or path.
 * @param {string} value Fonte value
 * @returns {{url?: string, json?: Promise<object>, config?: Promise<object|null>}} handed to
 *   loadBannerRows()
 */
function prefetchBanners(value) {
  const config = () => ({ config: getStorefrontConfig().catch(() => null) });
  let url;
  try {
    url = new URL((value || '').trim());
  } catch (e) {
    return config();
  }
  if (!/^https?:$/.test(url.protocol)) return config();
  if (url.origin === window.location.origin && url.pathname.startsWith('/graphql/')) return config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const json = fetch(url.href, { credentials: 'omit', signal: controller.signal })
    .then((resp) => {
      if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
      return resp.json();
    })
    .finally(() => clearTimeout(timer));
  json.catch(() => {}); // failures are handled where the response is used
  return { url: url.href, json };
}

function showSkeleton(block) {
  const skeleton = document.createElement('div');
  skeleton.className = 'carousel-hero-skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  block.replaceChildren(skeleton);
}

/* ---------------------------------------------------------------------------------------- */
/* Universal Editor: in-context editing of the banner Content Fragments (AEM connection)    */
/* ---------------------------------------------------------------------------------------- */

const cfText = (value) => {
  if (typeof value === 'string') return value.trim();
  return typeof value?.plaintext === 'string' ? value.plaintext.trim() : '';
};

function setProp(el, prop, type) {
  if (!el) return;
  el.dataset.aueProp = prop;
  el.dataset.aueType = type;
}

/**
 * Instruments a Content Fragment slide for the AEM connection (meta
 * urn:adobe:aue:system:aemconnection, added by ue/scripts/ue.js). Props inherit the slide's
 * data-aue-resource; data-cf-* attributes let ue.js apply related values (link, alt) live.
 */
function instrumentCfSlide(slide, { path, item, imageFields }, editorUrl) {
  const title = cfText(item.titulo);
  slide.dataset.aueResource = `urn:aemconnection:${path}/jcr:content/data/master`;
  slide.dataset.aueType = 'reference';
  slide.dataset.aueFilter = 'cf';
  slide.dataset.aueLabel = `Banner: ${title || path.split('/').pop()}`;

  setProp(slide.querySelector('.carousel-hero-title'), 'titulo', 'text');

  // resumo: one plain multi-line text element (instead of one <p> per paragraph)
  const content = slide.querySelector('.carousel-hero-slide-content');
  const resumo = cfText(item.resumo);
  if (content && resumo) {
    const paragraphs = [...content.querySelectorAll(':scope > p')];
    const p = document.createElement('p');
    p.className = 'carousel-hero-resumo';
    p.textContent = resumo;
    setProp(p, 'resumo', 'text');
    if (paragraphs.length) {
      paragraphs[0].before(p);
      paragraphs.forEach((para) => para.remove());
    } else {
      content.querySelector('.carousel-hero-title')?.after(p);
    }
  }

  const [cta, ctaSecondary] = slide.querySelectorAll('a.carousel-hero-cta');
  setProp(cta, 'ctaTexto', 'text');
  if (cta) cta.dataset.cfLinkProp = 'ctaLink';
  setProp(ctaSecondary, 'ctaSecundarioTexto', 'text');
  if (ctaSecondary) ctaSecondary.dataset.cfLinkProp = 'ctaSecundarioLink';

  slide.querySelectorAll('.carousel-hero-slide-image picture > img').forEach((img, i) => {
    if (!imageFields[i]) return;
    setProp(img, imageFields[i], 'media');
    img.dataset.cfAltProp = 'imagemAlt';
  });

  if (editorUrl) {
    const edit = document.createElement('a');
    edit.className = 'carousel-hero-ue-edit';
    edit.href = editorUrl;
    edit.target = '_blank';
    edit.rel = 'noopener noreferrer';
    edit.textContent = 'Editar no AEM';
    edit.title = `Abrir ${path} no editor de Content Fragments`;
    const wrap = document.createElement('p');
    wrap.className = 'carousel-hero-ue-edit-wrap';
    wrap.append(edit);
    (content || slide).append(wrap);
  }
}

/**
 * Editor only: renders the Content Fragment slides (instrumented) in place of the authored
 * ones, which stay in the DOM, hidden, as the fallback; on failure the authored slides stay.
 */
async function renderEditorCf(block, source, teardown) {
  setEditorBadge(block, BADGE_LOADING, source.source);
  try {
    const cf = await import('./carousel-hero-cf.js');
    const result = await cf.default(source);
    if (!result) throw new Error('no banners');
    const editorUrls = await Promise.all(result.rows.map(({ path }) => cf.getCfEditorUrl(path)));
    const fallback = [...block.querySelectorAll('.carousel-hero-slide')];
    const slides = result.rows.map((entry, i) => {
      const slide = buildSlide(entry.row, i, true);
      if (entry.path) {
        slide.dataset.cfPath = entry.path;
        instrumentCfSlide(slide, entry, editorUrls[i]);
      }
      return slide;
    });
    if (teardown) teardown();
    mount(block, slides);
    block.dataset.source = 'content-fragments';
    if (fallback.length) {
      const hidden = document.createElement('div');
      hidden.className = 'carousel-hero-fallback';
      hidden.hidden = true;
      const list = document.createElement('div');
      fallback.forEach((slide) => {
        slide.classList.remove('active');
        if (slide.dataset.aueLabel) slide.dataset.aueLabel = `${slide.dataset.aueLabel} (fallback autorado)`;
      });
      list.append(...fallback);
      hidden.append(list);
      block.append(hidden);
    }
    setEditorBadge(block, BADGE_CF, source.source);
  } catch (e) {
    setEditorBadge(block, BADGE_FAILED, source.source);
  }
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

  const mountAuthored = () => (rows.length
    ? mount(block, rows.map((row, i) => buildSlide(row, i)))
    : null);

  if (IS_UE) {
    const editorTeardown = mountAuthored();
    if (!editorTeardown) showSkeleton(block);
    if (source) renderEditorCf(block, source, editorTeardown);
    return;
  }
  if (!useCf) {
    mountAuthored();
    return;
  }

  // Content Fragments are the content: hold the hero height with a skeleton until they arrive
  // (no flash of the authored slides); the authored slides only show if the fetch fails
  let teardown = null;
  showSkeleton(block);
  block.setAttribute('aria-busy', 'true');
  const prefetched = prefetchBanners(source.source);
  let signature = '';
  const render = (result) => {
    const slides = result.rows.map(({ row, path }, i) => {
      const slide = buildSlide(row, i, true);
      if (path) slide.dataset.cfPath = path;
      return slide;
    });
    const active = block.querySelector('.carousel-hero-slide.active');
    const index = active ? Number(active.dataset.slideIndex) || 0 : 0;
    if (teardown) teardown();
    teardown = mount(block, slides, index);
    signature = result.signature;
    block.dataset.source = 'content-fragments';
    block.dataset.publico = result.audience;
  };

  import('./carousel-hero-cf.js')
    .then(({ default: loadBannerRows }) => loadBannerRows(source, prefetched)
      .then((result) => {
        if (!result) throw new Error('no banners');
        render(result);
        result.onDisplay();
        // published edits in AEM show up without a reload: re-check every few seconds while the
        // page is visible (one request at a time); slides are only rebuilt when banners changed
        let timer;
        let running = false;
        const refresh = async () => {
          clearTimeout(timer);
          if (running || document.hidden || !block.isConnected) return;
          running = true;
          try {
            const next = await loadBannerRows(source, null, { refresh: true });
            if (next && next.signature !== signature) render(next);
          } catch (e) {
            // keep the banners on screen; try again on the next round
          } finally {
            running = false;
            if (!document.hidden && block.isConnected) timer = setTimeout(refresh, REFRESH_MS);
          }
        };
        timer = setTimeout(refresh, FIRST_REFRESH_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) clearTimeout(timer);
          else refresh();
        });
      }))
    .catch(() => {
      // AEM unavailable: show the authored fallback; without one, drop the empty hero
      if (teardown) return;
      teardown = mountAuthored();
      if (!teardown) {
        block.replaceChildren();
        block.hidden = true;
      }
    })
    .finally(() => block.removeAttribute('aria-busy'));
}
