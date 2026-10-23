/*
 * Cards (plans)
 *
 * One row per plan:
 *   cell 1: optional badge paragraph (e.g. "Mais Vendido"), plan name heading,
 *           price paragraph ("<strong>R$ 24,90</strong> por mês"), note paragraph(s)
 *   cell 2: CTA link (e.g. "Quero o Plano Básico" / "Contratar")
 *   cell 3: coverages list; struck-through items (<del>/<s>) are NOT included
 *   cell 4: details / footnotes (optional)
 *   cell 5: SKU, plain text (optional) - e.g. "PROTEGE-CASA-BASICO" or "SKU: ..."
 *
 * Cells are classified by content first and position second, so omitted
 * cells do not shift the meaning of the others.
 *
 * Commerce hook
 * -------------
 * When a plan CTA is clicked the block dispatches a bubbling, cancelable
 *   CustomEvent('cards-plans:select', { detail: { sku, plan, price, href, card, link } })
 * on the card element. If a listener calls event.preventDefault() the link
 * navigation is cancelled (e.g. a commerce script adds the SKU to the cart and
 * opens express checkout). Otherwise the link navigates normally.
 * data-sku is set on the card and on the CTA when a SKU is authored.
 */

export const SELECT_EVENT = 'cards-plans:select';

const SKU_RE = /^(?:sku\s*[:-]?\s*)?([A-Za-z0-9][A-Za-z0-9._\-/]{0,63})$/i;

function text(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function parseSku(cell, position) {
  if (!cell || cell.querySelector('a, ul, ol, picture, img, h1, h2, h3, h4, h5, h6, strong, b')) return null;
  const raw = text(cell);
  const m = raw.match(SKU_RE);
  if (!m) return null;
  // a lone word in an earlier cell is more likely copy than a SKU: require the
  // 5th position, an explicit "SKU" prefix, or a code-like token
  const codeLike = /^sku/i.test(raw) || /[\d._\-/]/.test(m[1]);
  return position >= 4 || codeLike ? m[1] : null;
}

function isLinksOnly(cell) {
  const links = [...cell.querySelectorAll('a[href]')];
  if (!links.length) return false;
  const linkText = links.map((a) => text(a)).join('').replace(/\s/g, '');
  return linkText === text(cell).replace(/\s/g, '');
}

function srOnly(label) {
  const span = document.createElement('span');
  span.className = 'cards-plans-sr-only';
  span.textContent = label;
  return span;
}

function marker(type) {
  const span = document.createElement('span');
  span.className = `cards-plans-marker cards-plans-marker-${type}`;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = type === 'excluded' ? '×' : '✓';
  return span;
}

function classifyCells(cells) {
  const parts = {
    header: null, cta: null, coverages: null, details: [], sku: null,
  };
  cells.forEach((cell, i) => {
    if (!text(cell) && !cell.querySelector('picture, img')) return;
    if (!parts.coverages && cell.querySelector('ul, ol')) {
      parts.coverages = cell;
    } else if (i > 0 && !parts.sku && i === cells.length - 1 && parseSku(cell, i)) {
      parts.sku = parseSku(cell, i);
    } else if (!parts.cta && isLinksOnly(cell) && !cell.querySelector('h1, h2, h3, h4, h5, h6')) {
      parts.cta = cell;
    } else if (!parts.header && !parts.cta && !parts.coverages) {
      parts.header = cell;
    } else {
      parts.details.push(cell);
    }
  });
  return parts;
}

function decorateHeader(cell, card) {
  cell.className = 'cards-plans-header';
  const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('cards-plans-name');

  const paras = [...cell.querySelectorAll(':scope > p')];
  const children = [...cell.children];
  let priceFound = false;
  paras.forEach((p) => {
    if (heading && children.indexOf(p) < children.indexOf(heading)) {
      p.classList.add('cards-plans-badge');
      card.classList.add('cards-plans-featured');
    } else if (!priceFound && p.querySelector('strong, b')) {
      priceFound = true;
      p.classList.add('cards-plans-price');
      p.querySelector('strong, b').classList.add('cards-plans-price-value');
    } else {
      p.classList.add('cards-plans-note');
    }
  });
  return {
    plan: text(heading) || text(paras.find((p) => !p.classList.contains('cards-plans-badge'))),
    price: text(cell.querySelector('.cards-plans-price-value')),
  };
}

function decorateCoverages(cell) {
  cell.className = 'cards-plans-coverages';
  cell.querySelectorAll('li').forEach((li) => {
    const struck = [...li.querySelectorAll('del, s')];
    const struckText = struck.map((d) => text(d)).join('').replace(/\s/g, '');
    const excluded = struck.length && struckText.length >= text(li).replace(/\s/g, '').length;
    li.classList.add(excluded ? 'cards-plans-excluded' : 'cards-plans-included');
    li.prepend(marker(excluded ? 'excluded' : 'included'));
    if (excluded) li.append(srOnly(' (não incluso)'));
  });
}

function decorateCta(cell, card, info) {
  cell.className = 'cards-plans-cta';
  const links = [...cell.querySelectorAll('a[href]')];
  links.forEach((link, i) => {
    link.classList.add('button', i === 0 ? 'primary' : 'secondary');
    link.closest('p')?.classList.add('button-container');
    if (info.sku) link.dataset.sku = info.sku;
    if (info.plan) link.dataset.plan = info.plan;
  });
  const primary = links[0];
  if (!primary) return;
  primary.classList.add('cards-plans-select');
  primary.addEventListener('click', (e) => {
    const evt = new CustomEvent(SELECT_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: {
        sku: info.sku, plan: info.plan, price: info.price, href: primary.href, card, link: primary,
      },
    });
    if (!card.dispatchEvent(evt)) e.preventDefault();
  });
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'cards-plans-list';

  [...block.children].forEach((row, index) => {
    const cells = [...row.children];
    if (!cells.some((c) => text(c) || c.querySelector('picture, img'))) return;

    const card = document.createElement('li');
    card.className = 'cards-plans-card';
    const parts = classifyCells(cells);

    let info = { plan: '', price: '' };
    if (parts.header) {
      info = decorateHeader(parts.header, card);
      const heading = parts.header.querySelector('.cards-plans-name');
      if (heading) {
        heading.id = heading.id || `cards-plans-name-${index + 1}`;
        card.setAttribute('aria-labelledby', heading.id);
      }
      card.append(parts.header);
    }
    info.sku = parts.sku;
    if (info.sku) card.dataset.sku = info.sku;
    if (info.plan) card.dataset.plan = info.plan;

    if (parts.cta) {
      decorateCta(parts.cta, card, info);
      card.append(parts.cta);
    }
    if (parts.coverages) {
      decorateCoverages(parts.coverages);
      card.append(parts.coverages);
    }
    parts.details.forEach((cell) => {
      cell.className = 'cards-plans-details';
      card.append(cell);
    });

    ul.append(card);
  });

  block.classList.add(`cards-plans-${ul.children.length}-up`);
  block.replaceChildren(ul);
}
