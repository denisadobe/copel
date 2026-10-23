/* eslint-disable */
/* global WebImporter */

/**
 * Parser: accordion-faq
 * Source: Elementor nested accordion widgets (.elementor-widget-n-accordion) in #faq,
 * one block per widget. Each <details class="e-n-accordion-item"> holds:
 *   summary .e-n-accordion-item-title-text : question
 *   child container with text-editor (p / ul / ol) and heading widgets : answer
 *
 * Output rows (one per question): [question] [answer rich text]
 */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

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

function answerContent(document, item, summary) {
  const out = [];
  const content = [...item.children].filter((c) => c !== summary);
  content.forEach((root) => {
    let widgets = [...root.querySelectorAll('.elementor-widget')]
      .filter((w) => {
        const outer = w.parentElement.closest('.elementor-widget');
        return !outer || !root.contains(outer);
      });
    if (root.matches && root.matches('.elementor-widget')) widgets = [root];

    if (!widgets.length) {
      // plain rich text without Elementor widgets
      const blocks = [...root.querySelectorAll('p, ul, ol, table')].filter((b) => !b.parentElement.closest('p, ul, ol, table'));
      if (blocks.length) blocks.forEach((b) => { if (clean(b.textContent) || b.querySelector('img')) out.push(b); });
      else if (clean(root.textContent)) {
        const p = document.createElement('p');
        p.textContent = clean(root.textContent);
        out.push(p);
      }
      return;
    }

    widgets.forEach((w) => {
      if (w.classList.contains('elementor-widget-heading')) {
        const h = w.querySelector('h1, h2, h3, h4, h5, h6');
        const text = clean((h || w).textContent);
        if (!text) return;
        // sub-headings inside an answer (e.g. "Plano Basico") stay headings, below the group H3
        const n = document.createElement('h4');
        n.textContent = text;
        out.push(n);
        return;
      }
      if (w.classList.contains('elementor-widget-button')) {
        const a = w.querySelector('a[href]');
        const p = a && linkPara(document, a);
        if (p) out.push(p);
        return;
      }
      if (w.classList.contains('elementor-widget-image')) {
        const src = w.querySelector('img[src]');
        if (!src) return;
        const img = document.createElement('img');
        img.src = src.getAttribute('src');
        img.alt = src.getAttribute('alt') || '';
        out.push(img);
        return;
      }
      const container = w.querySelector('.elementor-widget-container') || w;
      const blocks = [...container.querySelectorAll('p, ul, ol, table, h1, h2, h3, h4, h5, h6')]
        .filter((b) => !b.parentElement.closest('p, ul, ol, table'));
      if (blocks.length) {
        blocks.forEach((b) => {
          if (!clean(b.textContent) && !b.querySelector('img')) return;
          if (/^H[1-6]$/.test(b.tagName)) {
            const n = document.createElement('h4');
            n.textContent = clean(b.textContent);
            out.push(n);
          } else {
            out.push(b);
          }
        });
      } else if (clean(container.textContent)) {
        const p = document.createElement('p');
        p.textContent = clean(container.textContent);
        out.push(p);
      }
    });
  });
  return out;
}

export default function parse(element, { document }) {
  const accordion = element.querySelector('.e-n-accordion') || element;
  const items = [...accordion.querySelectorAll('details.e-n-accordion-item')]
    .filter((d) => (d.parentElement.closest('.e-n-accordion') || accordion) === accordion);

  const cells = [];
  items.forEach((item) => {
    const summary = item.querySelector(':scope > summary');
    const qEl = summary && (summary.querySelector('.e-n-accordion-item-title-text') || summary);
    const question = clean(qEl && qEl.textContent);
    const answer = answerContent(document, item, summary);
    if (!question && !answer.length) return;
    cells.push([question || '', answer.length ? answer : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
