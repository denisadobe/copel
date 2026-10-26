import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  IS_UE, claimDecoration, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

/*
 * Hero (service)
 *
 *   row 1: background picture
 *   row 2: H1, paragraph lines, CTA link
 *   row 3 (optional): aside pictures (product logo, price seal)
 *
 * Rows are classified by content, not position, so authors may omit
 * the background or the aside row, or put everything in one row.
 * Pictures without an image (empty placeholders of a block added in the Universal Editor)
 * are ignored on the site and kept in the editor, where they stay selectable.
 */

const hasImage = (pic) => IS_UE || !!pic.querySelector('img')?.getAttribute('src');
const isPictureOnly = (el) => !!el.querySelector('picture, img') && !el.textContent.trim();

function optimize(pic, eager, width) {
  const img = pic.querySelector('img');
  if (!img?.getAttribute('src') || img.src.split('?')[0].endsWith('.svg')) return pic;
  const opt = createOptimizedPicture(img.src, img.alt, eager, [{ media: '(min-width: 900px)', width: '2000' }, { width }]);
  return replacePicture(pic, opt);
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const cells = [...block.children].flatMap((row) => [...row.children]);

  let background = null;
  const contentCells = [];
  const asidePictures = [];

  cells.forEach((cell) => {
    if (isPictureOnly(cell)) {
      const pics = [...cell.querySelectorAll('picture')].filter(hasImage);
      if (!background && !contentCells.length && pics.length) {
        background = pics.shift();
      }
      asidePictures.push(...pics);
    } else if (cell.textContent.trim() || cell.children.length) {
      contentCells.push(cell);
    }
  });

  const bg = document.createElement('div');
  bg.className = 'hero-service-background';
  if (background) bg.append(background);

  const content = document.createElement('div');
  content.className = 'hero-service-content';
  if (contentCells.length === 1) moveInstrumentation(contentCells[0], content);
  contentCells.forEach((cell) => {
    // pictures inside a text cell after the text are treated as aside media
    [...cell.querySelectorAll('picture')].forEach((pic) => {
      const p = pic.parentElement;
      asidePictures.push(pic);
      if (p && p.tagName === 'P' && !p.textContent.trim() && !p.children.length) p.remove();
    });
    content.append(...cell.childNodes);
  });
  [...content.querySelectorAll('p')].forEach((p) => {
    if (!p.textContent.trim() && !p.children.length) p.remove();
  });

  const cta = content.querySelector('a[href]');
  const ctaP = cta?.closest('p');
  if (ctaP) ctaP.classList.add('hero-service-cta');

  // source styling: first text paragraph is the accent tagline; in later
  // paragraphs, the line after the last <br> is highlighted
  const textPs = [...content.querySelectorAll(':scope > p')].filter((p) => p !== ctaP);
  textPs.forEach((p, i) => {
    if (i === 0) {
      p.classList.add('hero-service-tagline');
      return;
    }
    const brs = p.querySelectorAll('br');
    const last = brs[brs.length - 1];
    if (!last || p.querySelector('.hero-service-highlight')) return;
    const span = document.createElement('span');
    span.className = 'hero-service-highlight';
    while (last.nextSibling) span.append(last.nextSibling);
    if (span.textContent.trim()) last.after(span);
  });

  const aside = document.createElement('div');
  aside.className = 'hero-service-aside';
  asidePictures.forEach((pic, i) => {
    const item = document.createElement('div');
    item.className = `hero-service-aside-item hero-service-aside-item-${i + 1}`;
    item.append(pic);
    aside.append(item);
  });

  const inner = document.createElement('div');
  inner.className = 'hero-service-inner';
  inner.append(content);
  if (aside.children.length) inner.append(aside);

  block.replaceChildren(...(background ? [bg] : []), inner);
  block.classList.toggle('hero-service-no-image', !background);

  const bgPic = bg.querySelector('picture');
  if (bgPic) {
    const opt = optimize(bgPic, true, '750');
    const img = opt.querySelector('img');
    if (img) img.setAttribute('fetchpriority', 'high');
  }
  aside.querySelectorAll('picture').forEach((pic) => optimize(pic, true, '400'));
}
