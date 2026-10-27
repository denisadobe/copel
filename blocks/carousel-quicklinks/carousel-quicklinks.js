import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  claimDecoration, emptyMediaSlot, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

/*
 * Carousel (quicklinks)
 *
 * One row per tile:
 *   cell 1: icon (:icon-name: -> span.icon, or SVG/image picture)  (optional)
 *   cell 2: label as linked text
 *
 * Renders a horizontally scrollable (scroll-snap) track with prev/next arrows.
 * When a tile has a link, the whole tile becomes that link.
 */

function buildTile(row) {
  const li = document.createElement('li');
  moveInstrumentation(row, li);
  li.className = 'carousel-quicklinks-item';

  const cells = [...row.children];
  // editor: a tile just added has no icon yet, keep [icon | label] by position
  const iconCell = cells.find((c) => c.querySelector('span.icon, picture, img') && !c.textContent.trim())
    || emptyMediaSlot(cells);
  const textCells = cells.filter((c) => c !== iconCell);
  const link = row.querySelector('a[href]');

  const tile = document.createElement(link ? 'a' : 'div');
  tile.className = 'carousel-quicklinks-tile';
  if (link) {
    tile.href = link.href;
    if (link.title) tile.title = link.title;
    if (link.target) tile.target = link.target;
  }

  const icon = document.createElement('span');
  icon.className = 'carousel-quicklinks-icon';
  const iconSource = iconCell || row.querySelector('span.icon, picture');
  if (iconCell) {
    icon.append(...iconCell.childNodes);
  } else if (iconSource) {
    icon.append(iconSource);
  }
  if (icon.childNodes.length) tile.append(icon);

  const label = document.createElement('span');
  if (textCells.length === 1) moveInstrumentation(textCells[0], label);
  label.className = 'carousel-quicklinks-label';
  label.textContent = textCells.map((c) => c.textContent.trim()).filter(Boolean).join(' ')
    || (link ? link.textContent.trim() : '');
  if (label.textContent || label.hasAttribute('data-aue-prop')) tile.append(label);

  li.append(tile);
  return li;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const rows = [...block.children].filter((r) => !isEmptyRow(r));

  const track = document.createElement('ul');
  track.className = 'carousel-quicklinks-track';
  rows.forEach((row) => track.append(buildTile(row)));

  track.querySelectorAll('.carousel-quicklinks-icon img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const isSvg = src.startsWith('data:image/svg')
      || (!src.startsWith('data:') && new URL(src, window.location.href).pathname.endsWith('.svg'));
    if (isSvg) {
      // tint monochrome SVGs via a CSS mask (createOptimizedPicture breaks data URIs)
      const wrap = img.closest('.carousel-quicklinks-icon');
      wrap.classList.add('carousel-quicklinks-icon-mask');
      wrap.style.setProperty('--carousel-quicklinks-icon', `url("${src.replace(/"/g, '%22')}")`);
      return;
    }
    if (!src || src.startsWith('data:')) return;
    const picture = img.closest('picture');
    if (picture) replacePicture(picture, createOptimizedPicture(src, img.alt, false, [{ width: '160' }]));
  });

  const viewport = document.createElement('div');
  viewport.className = 'carousel-quicklinks-viewport';
  viewport.append(track);

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'carousel-quicklinks-prev';
  prev.setAttribute('aria-label', 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-quicklinks-next';
  next.setAttribute('aria-label', 'Next');

  block.replaceChildren(prev, viewport, next);

  const scrollByPage = (dir) => {
    const [first, second] = track.querySelectorAll('.carousel-quicklinks-item');
    const width = first ? first.getBoundingClientRect().width : track.clientWidth;
    const step = first && second ? second.offsetLeft - first.offsetLeft : width;
    const gap = Math.max(0, step - width);
    const perPage = Math.max(1, Math.floor((track.clientWidth + gap + 1) / step));
    track.scrollBy({ left: dir * step * perPage, behavior: 'smooth' });
  };

  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 1;
    prev.disabled = track.scrollLeft <= 0;
    next.disabled = track.scrollLeft >= max;
    block.classList.toggle('carousel-quicklinks-static', max <= 0);
  };

  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', update, { passive: true });
  // first run from the observer, after layout (no forced reflow while the page decorates)
  if (window.ResizeObserver) new ResizeObserver(update).observe(track);
  else update();
}
