/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-news
 * Sources (Elementor posts widgets, detected structurally):
 *   - Home (.elementor-element-ae6699a): container with several posts widgets -
 *     one featured widget + 4-post grid; mobile-only widgets
 *     (.elementor-hidden-desktop) repeat the same posts and are skipped; posts
 *     are de-duplicated by post id. -> "Cards News" (featured first).
 *   - Noticias listing, destaque (.elementor-element-72046274): a single posts
 *     widget holding exactly one article with the image above the text
 *     -> "Cards News (stacked)".
 *   - Noticias listing, grid (.elementor-element-fe6c3a8): a single posts
 *     widget with several articles / pagination (pagination nav is removed by
 *     the cleanup transformer) -> "Cards News (no-featured)".
 *
 * Output rows (one per article, featured first), matching the news-article CF:
 *   cell 1: thumbnail <img>
 *   cell 2: <p>category</p> <h3><a>title</a></h3> <p>dd/mm/yyyy</p>
 *           <p>summary</p> <p><a>Leia mais</a></p>
 */

const CATEGORY_LABELS = {
  destaque: 'Destaque',
  noticias: 'Notícias',
};

function categoryLabel(article) {
  const badge = article.querySelector('.elementor-post__badge');
  const badgeText = badge ? badge.textContent.replace(/\s+/g, ' ').trim() : '';
  if (badgeText) return badgeText;
  const cls = [...article.classList].find((c) => c.startsWith('category-'));
  if (!cls) return '';
  const slug = cls.slice('category-'.length);
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDate(text) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  let m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

function postId(article) {
  const cls = [...article.classList].find((c) => /^post-\d+$/.test(c));
  return cls || null;
}

/**
 * Pick the block variant from the widget structure.
 *   several desktop posts widgets (featured + grid) -> plain
 *   one widget, one article, image on top          -> stacked
 *   one widget, list/grid (several posts/pagination) -> no-featured
 */
function variantName(element, articles, hasPagination) {
  const widgets = [
    ...(element.matches('.elementor-widget-posts') ? [element] : []),
    ...element.querySelectorAll('.elementor-widget-posts'),
  ];
  const desktopWidgets = widgets.filter((w) => !w.closest('.elementor-hidden-desktop'));
  const pool = desktopWidgets.length ? desktopWidgets : widgets;
  if (pool.length !== 1) return 'Cards News';

  const widget = pool[0];
  // image above text unless the widget is explicitly laid out thumbnail-left
  const thumbTop = !widget.classList.contains('elementor-posts--thumbnail-left');
  if (articles.length === 1 && !hasPagination && thumbTop) return 'Cards News (stacked)';
  if (articles.length > 1 || hasPagination) return 'Cards News (no-featured)';
  return 'Cards News';
}

// Repeating unit = one post. Primary: <article class="elementor-post">;
// fallbacks for skins that render posts as card/grid-item divs.
const ITEM_SELECTORS = [
  'article.elementor-post',
  '.elementor-posts-container > .elementor-grid-item',
  '.elementor-post__card',
];

function findItems(element) {
  for (const sel of ITEM_SELECTORS) {
    const found = [...element.querySelectorAll(sel)];
    if (found.length) return found;
  }
  return [];
}

export default function parse(element, { document }) {
  const cells = [];
  const seen = new Set();

  // Pagination / load-more (listing grid) is not content. The cleanup
  // transformer removes it; detect it first for the variant, then drop it so
  // a.page-numbers can never be taken as items.
  const pagers = [...element.querySelectorAll('nav.elementor-pagination, .page-numbers, .e-load-more-anchor')];
  const hasPagination = pagers.length > 0;
  pagers.forEach((p) => p.remove());

  const all = findItems(element);
  const desktop = all.filter((a) => !a.closest('.elementor-hidden-desktop'));
  const articles = desktop.length ? desktop : all;
  const name = variantName(element, articles, hasPagination);

  articles.forEach((article) => {
    const id = postId(article);
    if (id && seen.has(id)) return;
    if (id) seen.add(id);

    const titleEl = article.querySelector('.elementor-post__title');
    const titleLink = titleEl && titleEl.querySelector('a[href]');
    const thumbLink = article.querySelector('a.elementor-post__thumbnail__link[href]');
    const readMore = article.querySelector('a.elementor-post__read-more[href]');
    const href = (titleLink || readMore || thumbLink)?.getAttribute('href') || '';
    const title = (titleEl ? titleEl.textContent : '').replace(/\s+/g, ' ').trim();
    if (!title && !href) return;

    // image
    const imageCell = [];
    const srcImg = article.querySelector('.elementor-post__thumbnail img');
    if (srcImg) {
      const src = srcImg.getAttribute('src') || srcImg.getAttribute('data-src') || srcImg.getAttribute('data-lazy-src');
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = srcImg.getAttribute('alt') || title;
        imageCell.push(img);
      }
    }

    // body
    const body = [];
    const category = categoryLabel(article);
    if (category) {
      const p = document.createElement('p');
      p.textContent = category;
      body.push(p);
    }
    if (title) {
      const h3 = document.createElement('h3');
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = title;
        h3.append(a);
      } else {
        h3.textContent = title;
      }
      body.push(h3);
    }
    const dateEl = article.querySelector('.elementor-post-date');
    if (dateEl && dateEl.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = formatDate(dateEl.textContent);
      body.push(p);
    }
    const excerpt = article.querySelector('.elementor-post__excerpt');
    if (excerpt) {
      const text = excerpt.textContent.replace(/\s+/g, ' ').trim();
      if (text) {
        const p = document.createElement('p');
        p.textContent = text;
        body.push(p);
      }
    }
    if (href) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = readMore ? (readMore.textContent.replace(/\s+/g, ' ').trim() || 'Leia mais') : 'Leia mais';
      p.append(a);
      body.push(p);
    }

    cells.push([imageCell.length ? imageCell : '', body]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name, cells });
  element.replaceWith(block);
}
