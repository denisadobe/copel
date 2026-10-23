/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-plans
 * Source: Elementor nested carousel (swiper) .elementor-element-9d43412 in #planos.
 * Each real slide (loop duplicates skipped, deduped by plan name) is one plan:
 *   heading widgets : optional badge (H6 "Mais Vendido"), plan name (H5),
 *                     price (H1 "R$ 24,90 <span>por mes</span>"), note (H5)
 *   button widget   : "Quero o Plano ..." -> /pvs/login?plano=protege-casa-...
 *   icon-list widgets: coverages; fa-times-circle items are NOT included
 *   button widget   : "Veja mais detalhes das coberturas" (PDF)
 *   text-editor     : footnotes, "Consulte as Condicoes Gerais" link
 *
 * Output rows (one per plan, 5 cells):
 *   1: [<p>badge</p>] <h3>plan name</h3> <p><strong>R$ 24,90</strong> por mes</p> <p>note</p>
 *   2: <p><a>CTA</a></p>
 *   3: <ul><li>included</li><li><del>excluded</del></li></ul>
 *   4: <p><a>PDF</a></p> <p>footnotes</p> <p><a>Condicoes Gerais</a></p>
 *   5: SKU placeholder (value of the CTA ?plano= parameter)
 */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function getSlides(root) {
  const slides = [...root.querySelectorAll('.swiper-slide')]
    .filter((s) => !s.classList.contains('swiper-slide-duplicate'));
  if (slides.length) return slides;
  const wrapper = root.querySelector('.swiper-wrapper, .e-n-carousel');
  return wrapper ? [...wrapper.children] : [];
}

/** Copy inline content (text, <br>, bold/italic, links), unwrapping spans and icons. */
function copyInline(document, src, target) {
  src.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      target.append(document.createTextNode(n.textContent.replace(/\s+/g, ' ')));
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'BR') { target.append(document.createElement('br')); return; }
    if (tag === 'SVG' || tag === 'svg' || (tag === 'I' && !n.textContent.trim())) return;
    if (tag === 'STRONG' || tag === 'B') {
      if (!n.textContent.trim()) return;
      const el = document.createElement('strong');
      copyInline(document, n, el);
      target.append(el);
      return;
    }
    if (tag === 'EM' || tag === 'I') {
      const el = document.createElement('em');
      copyInline(document, n, el);
      target.append(el);
      return;
    }
    if (tag === 'A' && n.getAttribute('href')) {
      const a = document.createElement('a');
      a.href = n.getAttribute('href');
      copyInline(document, n, a);
      target.append(a);
      return;
    }
    copyInline(document, n, target);
  });
  return target;
}

/** Trim leading/trailing whitespace and line breaks; tidy whitespace around <br>. */
function trimNode(el) {
  const blank = (n) => n && ((n.nodeType === 3 && !n.textContent.trim()) || n.nodeName === 'BR');
  while (blank(el.firstChild)) el.firstChild.remove();
  while (blank(el.lastChild)) el.lastChild.remove();
  if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = el.firstChild.textContent.replace(/^\s+/, '');
  if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = el.lastChild.textContent.replace(/\s+$/, '');
  el.querySelectorAll('br').forEach((br) => {
    const prev = br.previousSibling;
    const next = br.nextSibling;
    if (prev && prev.nodeType === 3) prev.textContent = prev.textContent.replace(/\s+$/, '');
    if (next && next.nodeType === 3) next.textContent = next.textContent.replace(/^\s+/, '');
  });
  return el;
}

function linkPara(document, a) {
  const label = clean((a.querySelector('.elementor-button-text') || a).textContent);
  if (!label) return null;
  const p = document.createElement('p');
  const link = document.createElement('a');
  link.href = a.getAttribute('href');
  link.textContent = label;
  p.append(link);
  return p;
}

/** "R$ 24,90 <span>por mes</span>" -> <p><strong>R$ 24,90</strong> por mes</p> */
function pricePara(document, h) {
  const clone = h.cloneNode(true);
  const period = [...clone.querySelectorAll('span')].map((s) => clean(s.textContent)).filter(Boolean).join(' ');
  clone.querySelectorAll('span').forEach((s) => s.remove());
  let value = clean(clone.textContent);
  let rest = period;
  if (!value) {
    const m = clean(h.textContent).match(/^(R\$\s*[\d.,]+)\s*(.*)$/);
    value = m ? m[1] : clean(h.textContent);
    rest = m ? m[2] : '';
  }
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = value;
  p.append(strong);
  if (rest) p.append(document.createTextNode(` ${rest}`));
  return p;
}

const isExcluded = (li) => li.hasAttribute('data-excluded') || !!li.querySelector('.fa-times-circle, .fa-times, .fa-close, [class*="times-circle"], [class*="e-fas-times"]');

function parsePlan(document, slide) {
  const header = [];
  const ctaCell = [];
  const details = [];
  const ul = document.createElement('ul');
  let ctaHref = '';
  let planName = '';

  // heading widgets before the first button form the header
  const widgets = [...slide.querySelectorAll('.elementor-widget')]
    .filter((w) => {
      // skip widgets nested in another widget of this slide (the carousel itself is an outer widget)
      const outer = w.parentElement.closest('.elementor-widget');
      return !outer || !slide.contains(outer);
    });
  const firstButton = widgets.findIndex((w) => w.classList.contains('elementor-widget-button'));
  const headWidgets = widgets.slice(0, firstButton < 0 ? widgets.length : firstButton)
    .filter((w) => w.classList.contains('elementor-widget-heading'));
  const headings = headWidgets.map((w) => w.querySelector('h1, h2, h3, h4, h5, h6')).filter((h) => h && clean(h.textContent));
  const priceIdx = headings.findIndex((h) => /R\$\s*\d/.test(h.textContent));
  const nameIdx = priceIdx > 0 ? priceIdx - 1 : (priceIdx === 0 ? -1 : 0);
  headings.forEach((h, i) => {
    if (i === priceIdx) { header.push(pricePara(document, h)); return; }
    if (i === nameIdx) {
      planName = clean(h.textContent);
      const h3 = document.createElement('h3');
      h3.textContent = planName;
      header.push(h3);
      return;
    }
    const p = trimNode(copyInline(document, h, document.createElement('p')));
    if (clean(p.textContent)) header.push(p); // badge (before name) or note (after price)
  });

  let seenList = false;
  widgets.slice(firstButton < 0 ? widgets.length : firstButton).forEach((w) => {
    if (w.classList.contains('elementor-widget-button')) {
      const a = w.querySelector('a[href]');
      const p = a && linkPara(document, a);
      if (!p) return;
      if (!seenList && !ctaCell.length) {
        ctaCell.push(p);
        ctaHref = a.getAttribute('href');
      } else {
        details.push(p);
      }
      return;
    }
    if (w.classList.contains('elementor-widget-icon-list')) {
      seenList = true;
      w.querySelectorAll('li').forEach((src) => {
        const textEl = src.querySelector('.elementor-icon-list-text') || src;
        const li = document.createElement('li');
        const content = trimNode(copyInline(document, textEl, document.createElement('span')));
        if (!clean(content.textContent)) return;
        if (isExcluded(src)) {
          const del = document.createElement('del');
          del.append(...content.childNodes);
          li.append(del);
        } else {
          li.append(...content.childNodes);
        }
        ul.append(li);
      });
      return;
    }
    if (w.classList.contains('elementor-widget-text-editor') || w.classList.contains('elementor-widget-heading')) {
      const root = w.querySelector('.elementor-widget-container') || w;
      const blocks = [...root.querySelectorAll('p, ul, ol, h1, h2, h3, h4, h5, h6')].filter((b) => !b.parentElement.closest('p, ul, ol'));
      const sources = blocks.length ? blocks : [root];
      sources.forEach((b) => {
        if (!clean(b.textContent)) return;
        if (b.tagName === 'UL' || b.tagName === 'OL') { details.push(b); return; }
        const p = trimNode(copyInline(document, b, document.createElement('p')));
        if (clean(p.textContent)) details.push(p);
      });
    }
  });

  let sku = '';
  const m = (ctaHref || '').match(/[?&]plano=([^&#]+)/);
  if (m) sku = decodeURIComponent(m[1]);

  return { planName, header, ctaCell, ul, details, sku };
}

export default function parse(element, { document }) {
  const cells = [];
  const seen = new Set();
  getSlides(element).forEach((slide) => {
    const plan = parsePlan(document, slide);
    if (!plan.header.length && !plan.ctaCell.length && !plan.ul.children.length) return;
    const key = plan.planName || plan.sku;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    const skuCell = [];
    if (plan.sku) {
      const p = document.createElement('p');
      p.textContent = plan.sku;
      skuCell.push(p);
    }
    cells.push([
      plan.header.length ? plan.header : '',
      plan.ctaCell.length ? plan.ctaCell : '',
      plan.ul.children.length ? [plan.ul] : '',
      plan.details.length ? plan.details : '',
      skuCell.length ? skuCell : '',
    ]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-plans', cells });
  element.replaceWith(block);
}
