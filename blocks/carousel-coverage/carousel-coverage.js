import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  claimDecoration, emptyMediaSlot, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

/*
 * Carousel (coverage)
 *
 * One row per card:
 *   cell 1: photo (optional)
 *   cell 2: plan tag links (paragraph of links, e.g. Basico / Premium -> #planos),
 *           H3 title, description paragraph(s)
 *
 * Renders a horizontally scrollable (scroll-snap) track of cards with
 * prev/next arrows and page dots. Several cards are visible at once.
 */

const isPictureOnly = (el) => !!el.querySelector('picture, img') && !el.textContent.trim();

function buildCard(row) {
  const li = document.createElement('li');
  moveInstrumentation(row, li);
  li.className = 'carousel-coverage-item';

  const card = document.createElement('div');
  card.className = 'carousel-coverage-card';

  const cells = [...row.children];
  // editor: a card just added has no photo yet, keep [photo | body] by position
  const imageCell = cells.find(isPictureOnly) || emptyMediaSlot(cells);
  const bodyCells = cells.filter((c) => c !== imageCell);

  if (imageCell) {
    const media = document.createElement('div');
    media.className = 'carousel-coverage-image';
    const pic = imageCell.querySelector('picture') || imageCell.querySelector('img');
    if (pic) media.append(pic);
    card.append(media);
  }

  const body = document.createElement('div');
  body.className = 'carousel-coverage-body';
  if (bodyCells.length === 1) moveInstrumentation(bodyCells[0], body);
  bodyCells.forEach((c) => body.append(...c.childNodes));

  // a paragraph that contains only links (before the title) holds the plan tags
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  const tagPara = [...body.querySelectorAll('p')].find((p) => {
    const links = p.querySelectorAll('a');
    if (!links.length) return false;
    const strip = (t) => t.replace(/[\s|,/•·-]+/g, '');
    const linkText = strip([...links].map((a) => a.textContent).join(''));
    const ordered = [...body.querySelectorAll('p, h1, h2, h3, h4, h5, h6')];
    const before = !heading || ordered.indexOf(p) < ordered.indexOf(heading);
    return before && linkText === strip(p.textContent);
  });
  if (tagPara) {
    const tags = document.createElement('div');
    tags.className = 'carousel-coverage-tags';
    tagPara.querySelectorAll('a').forEach((a) => {
      a.className = 'carousel-coverage-tag';
      const slug = a.textContent.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');
      if (slug) a.classList.add(`carousel-coverage-tag-${slug}`);
      tags.append(a);
    });
    tagPara.replaceWith(tags);
  }
  if (heading) heading.classList.add('carousel-coverage-title');

  [...body.querySelectorAll('p')].forEach((p) => {
    if (!p.textContent.trim() && !p.children.length) p.remove();
  });

  card.append(body);
  li.append(card);
  return li;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const rows = [...block.children].filter((r) => !isEmptyRow(r, 'picture, img'));

  const track = document.createElement('ul');
  track.className = 'carousel-coverage-track';
  track.setAttribute('tabindex', '0');
  track.setAttribute('aria-label', 'Coberturas');
  rows.forEach((row) => track.append(buildCard(row)));

  track.querySelectorAll('picture > img').forEach((img) => {
    if (!img.getAttribute('src') || img.src.split('?')[0].endsWith('.svg')) return;
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ width: '600' }]));
  });

  const viewport = document.createElement('div');
  viewport.className = 'carousel-coverage-viewport';
  viewport.append(track);

  const mkButton = (cls, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    return b;
  };
  const prev = mkButton('carousel-coverage-prev', 'Anterior');
  const next = mkButton('carousel-coverage-next', 'Próximo');

  const dots = document.createElement('div');
  dots.className = 'carousel-coverage-dots';

  const controls = document.createElement('div');
  controls.className = 'carousel-coverage-controls';
  controls.append(prev, viewport, next);

  block.replaceChildren(controls, dots);

  const items = () => [...track.children];
  const step = () => {
    const item = track.firstElementChild;
    return item ? item.getBoundingClientRect().width : track.clientWidth;
  };
  const perPage = () => Math.max(1, Math.round(track.clientWidth / (step() || 1)));
  const pageCount = () => Math.max(1, Math.ceil(items().length / perPage()));

  const goToPage = (page) => {
    track.scrollTo({ left: page * perPage() * step(), behavior: 'smooth' });
  };

  const renderDots = () => {
    const count = pageCount();
    if (dots.children.length === count) return;
    dots.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const dot = mkButton('carousel-coverage-dot', `Página ${i + 1} de ${count}`);
      dot.addEventListener('click', () => goToPage(i));
      dots.append(dot);
    }
  };

  const update = () => {
    renderDots();
    const max = track.scrollWidth - track.clientWidth - 1;
    prev.disabled = track.scrollLeft <= 0;
    next.disabled = track.scrollLeft >= max;
    block.classList.toggle('carousel-coverage-static', max <= 0);
    const pageWidth = perPage() * step() || 1;
    const current = track.scrollLeft >= max
      ? pageCount() - 1
      : Math.round(track.scrollLeft / pageWidth);
    [...dots.children].forEach((d, i) => {
      if (i === current) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -perPage() * step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: perPage() * step(), behavior: 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
  });
  if (window.ResizeObserver) new ResizeObserver(update).observe(track);
  update();
}
