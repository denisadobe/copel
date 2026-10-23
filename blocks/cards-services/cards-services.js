import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Cards (services)
 *
 * One row per service tile:
 *   cell 1: icon (:icon-name: -> span.icon, or an SVG/image picture)  (optional)
 *   cell 2: label as linked text, optional "Veja mais" link
 *
 * Cells may be missing or merged; the icon is detected by span.icon / picture.
 */

function isIconCell(cell) {
  const hasIcon = cell.querySelector('span.icon, picture, img');
  const text = cell.textContent.trim();
  return hasIcon && !text;
}

export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('span.icon, picture, img')) return;
    const li = document.createElement('li');
    li.className = 'cards-services-card';

    const cells = [...row.children];
    const iconCell = cells.find(isIconCell);
    const body = document.createElement('div');
    body.className = 'cards-services-card-body';
    cells.filter((c) => c !== iconCell).forEach((c) => {
      while (c.firstChild) body.append(c.firstChild);
    });

    if (iconCell) {
      iconCell.className = 'cards-services-card-icon';
      li.append(iconCell);
    } else {
      // icon authored inline with the label
      const inlineIcon = body.querySelector('span.icon, picture');
      if (inlineIcon) {
        const iconWrap = document.createElement('div');
        iconWrap.className = 'cards-services-card-icon';
        const parent = inlineIcon.parentElement;
        iconWrap.append(inlineIcon);
        const isEmpty = !parent.textContent.trim() && !parent.children.length;
        if (parent !== body && isEmpty) parent.remove();
        li.append(iconWrap);
      }
    }

    const links = [...body.querySelectorAll('a[href]')];
    if (links.length) {
      links[0].classList.add('cards-services-card-label');
      links.slice(1).forEach((a) => a.classList.add('cards-services-card-more'));
    } else {
      const first = body.querySelector('p, h2, h3, h4, h5, h6');
      if (first) first.classList.add('cards-services-card-label');
    }
    // a lone link must not be styled as a default button
    body.querySelectorAll('a.button').forEach((a) => a.classList.remove('button', 'primary', 'secondary'));
    body.querySelectorAll('.button-container').forEach((p) => p.classList.remove('button-container'));

    li.append(body);
    ul.append(li);
  });

  ul.querySelectorAll('.cards-services-card-icon img').forEach((img) => {
    const { src } = img;
    const isSvg = src.startsWith('data:image/svg') || new URL(src).pathname.endsWith('.svg');
    if (isSvg) {
      // monochrome SVG icons are tinted with the brand color through a CSS mask
      const wrap = img.closest('.cards-services-card-icon');
      wrap.classList.add('cards-services-card-icon-mask');
      wrap.style.setProperty('--cards-services-icon', `url("${src.replace(/"/g, '%22')}")`);
      return;
    }
    if (src.startsWith('data:')) return;
    const picture = img.closest('picture');
    if (picture) picture.replaceWith(createOptimizedPicture(src, img.alt, false, [{ width: '160' }]));
  });

  block.replaceChildren(ul);
}
