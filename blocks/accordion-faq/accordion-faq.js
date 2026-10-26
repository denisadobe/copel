/*
 * Accordion (FAQ)
 *
 * One row per question:
 *   cell 1: question (title text)
 *   cell 2: answer (paragraphs, lists, links)
 *
 * Uses native <details>/<summary> (keyboard and screen-reader support built in).
 * One block per FAQ group; the group heading is default content before the block.
 * If a row has a single cell, its first element is the question and the rest the answer.
 *
 * Options (block classes):
 *   single-open: only one item of the block can be open at a time.
 */

import { IS_UE, claimDecoration, moveInstrumentation } from '../../scripts/ue-utils.js';

let singleOpenCount = 0;

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const items = [];

  [...block.children].forEach((row) => {
    // in the editor every cell counts: a question just added is still empty
    const cells = [...row.children].filter((c) => IS_UE || c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length && !IS_UE) return;

    let questionNodes = [];
    let answerNodes = [];
    let questionCell = null;
    let answerCell = null;
    if (!cells.length) {
      // empty row kept in the editor
    } else if (cells.length === 1) {
      const [only] = cells;
      const first = only.firstElementChild;
      if (first && only.children.length > 1) {
        questionNodes = [...first.childNodes];
        answerNodes = [...only.children].slice(1);
      } else {
        questionNodes = [...only.childNodes];
        answerNodes = [];
      }
    } else {
      const [q, ...rest] = cells;
      questionCell = q;
      if (rest.length === 1) [answerCell] = rest;
      // flatten a single wrapping paragraph/heading in the question cell
      const qWrap = q.children.length === 1 && q.firstElementChild.matches('p, h1, h2, h3, h4, h5, h6')
        ? q.firstElementChild : q;
      questionNodes = [...qWrap.childNodes];
      answerNodes = rest.flatMap((c) => [...c.childNodes]);
    }

    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-faq-item';

    const summary = document.createElement('summary');
    summary.className = 'accordion-faq-question';
    const label = document.createElement('span');
    label.className = 'accordion-faq-question-text';
    label.append(...questionNodes);
    moveInstrumentation(questionCell, label);
    summary.append(label);

    const answer = document.createElement('div');
    answer.className = 'accordion-faq-answer';
    answer.append(...answerNodes);
    moveInstrumentation(answerCell, answer);

    details.append(summary);
    if (answer.textContent.trim() || answer.querySelector('picture, img') || IS_UE) details.append(answer);
    else details.classList.add('accordion-faq-empty');
    items.push(details);
  });

  block.replaceChildren(...items);

  // option "single-open": opening one item closes the others in the same block.
  // The shared `name` gives native exclusive accordions; the toggle listener
  // covers browsers without support for it.
  if (block.classList.contains('single-open')) {
    singleOpenCount += 1;
    const group = `accordion-faq-group-${singleOpenCount}`;
    items.forEach((details) => {
      details.name = group;
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        items.forEach((other) => {
          if (other !== details && other.open) other.removeAttribute('open');
        });
      });
    });
  }

  // open the item that matches a deep link (#id inside an answer or on the item)
  const { hash } = window.location;
  if (hash && hash.length > 1) {
    try {
      const target = block.querySelector(hash);
      target?.closest('details')?.setAttribute('open', '');
    } catch (e) {
      // invalid selector in hash; ignore
    }
  }
}
