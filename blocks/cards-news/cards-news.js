import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Cards (news)
 *
 * Stable cell contract (mirrors the "news-article" Content Fragment model so
 * the same markup can be produced from AEM headless GraphQL data):
 *
 *   <div class="cards-news">
 *     <div>                                       <- one row per news item
 *       <div><picture>…</picture></div>           <- cell 1: image        (CF: image)
 *       <div>                                     <- cell 2: body
 *         <p>Destaque</p>                         <- before heading       (CF: category)
 *         <h3><a href="link">title</a></h3>       <- heading              (CF: title, link)
 *         <p>21/10/2026</p>                       <- dd/mm/yyyy paragraph (CF: date)
 *         <p>summary…</p>                         <- other paragraph(s)   (CF: summary)
 *         <p><a href="link">Leia mais</a></p>     <- link-only paragraph  (CF: link)
 *       </div>
 *     </div>
 *   </div>
 *
 * Every field is optional. The first item is rendered as "featured" unless the
 * "no-featured" option is set. The "stacked" option keeps the featured item
 * as image-above-text at every width (layout handled in CSS). The
 * "no-featured" grid sizes its columns from the block's own width so it fits
 * narrow containers (e.g. a 2/3 split section). Each detected field gets a
 * `cards-news-<field>` class and `data-field="<field>"` attribute.
 */

const DATE_RE = /^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\s*$/;

function mark(el, field) {
  el.classList.add(`cards-news-${field}`);
  el.dataset.field = field;
}

function decorateBody(body) {
  const children = [...body.children];
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  let headingSeen = !heading;
  let dateFound = false;

  children.forEach((el) => {
    if (el === heading) {
      headingSeen = true;
      mark(el, 'title');
      return;
    }
    const text = el.textContent.trim();
    const links = el.querySelectorAll('a[href]');
    const isLinkOnly = links.length === 1 && links[0].textContent.trim() === text;

    if (!headingSeen) {
      // content before the heading is the category label (may be a link)
      mark(el, 'category');
    } else if (!dateFound && DATE_RE.test(text)) {
      dateFound = true;
      mark(el, 'date');
      if (!el.querySelector('time')) {
        const time = document.createElement('time');
        const [d, m, y] = text.split(/[/.-]/);
        if (y && y.length === 4) time.dateTime = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        time.textContent = text;
        el.replaceChildren(time);
      }
    } else if (isLinkOnly && el.tagName === 'P') {
      mark(el, 'more');
      links[0].classList.remove('button', 'primary', 'secondary');
      el.classList.remove('button-container');
    } else if (text) {
      mark(el, 'summary');
    }
  });

  // if the title has no link, borrow the "Leia mais" link href
  if (heading && !heading.querySelector('a')) {
    const more = body.querySelector('.cards-news-more a');
    if (more) {
      const a = document.createElement('a');
      a.href = more.href;
      a.append(...heading.childNodes);
      heading.append(a);
    }
  }
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  const featured = !block.classList.contains('no-featured');

  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img')) return;
    const li = document.createElement('li');
    li.className = 'cards-news-card';

    const cells = [...row.children];
    const imageCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim());
    const body = document.createElement('div');
    body.className = 'cards-news-card-body';
    cells.filter((c) => c !== imageCell).forEach((c) => {
      while (c.firstChild) body.append(c.firstChild);
    });
    // stray picture inside body becomes the image
    let image = imageCell;
    if (!image) {
      const pic = body.querySelector('picture');
      if (pic) {
        image = document.createElement('div');
        const parent = pic.parentElement;
        image.append(pic);
        const isEmpty = !parent.textContent.trim() && !parent.children.length;
        if (parent !== body && isEmpty) parent.remove();
      }
    }

    if (image) {
      image.className = 'cards-news-card-image';
      image.dataset.field = 'image';
      li.append(image);
    }
    decorateBody(body);
    li.append(body);
    ul.append(li);
  });

  if (featured && ul.firstElementChild) ul.firstElementChild.classList.add('cards-news-featured');

  ul.querySelectorAll('picture > img').forEach((img, i) => {
    const width = i === 0 && featured ? '1200' : '750';
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width }]));
  });

  block.replaceChildren(ul);
}
