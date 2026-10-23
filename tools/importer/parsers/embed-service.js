/* eslint-disable */
/* global WebImporter */

/**
 * Parser: embed-service
 * Source: Elementor HTML widget (.elementor-widget-html) wrapping an
 *   <iframe src="https://www.copel.com/slwweb/..." title="Serviços Copel">.
 *
 * Output (1 column, matches blocks/embed-service decorate):
 *   row 1: <a href="{iframe src}">{iframe title || "Serviços Copel"}</a>
 *   row 2 (optional): height such as "850px", from iframe height attr / style
 */

const DEFAULT_TITLE = 'Serviços Copel';

function normalizeHeight(value) {
  const m = String(value || '').trim().match(/^(\d{2,4}(?:\.\d+)?)\s*(px|vh|rem|em)?$/i);
  if (!m) return null;
  return `${m[1]}${(m[2] || 'px').toLowerCase()}`;
}

function iframeHeight(iframe) {
  const fromAttr = normalizeHeight(iframe.getAttribute('height'));
  if (fromAttr) return fromAttr;
  const style = iframe.getAttribute('style') || '';
  const m = style.match(/(?:^|;)\s*(?:min-)?height\s*:\s*([^;]+)/i);
  return m ? normalizeHeight(m[1].replace(/!important/i, '')) : null;
}

export default function parse(element, { document }) {
  const iframe = element.querySelector('iframe[src]');
  const src = iframe ? iframe.getAttribute('src') : '';

  if (!src) {
    // nothing embeddable: drop the empty widget wrapper
    element.remove();
    return;
  }

  let href = src;
  try {
    href = new URL(src, document.baseURI || 'https://www.copel.com/').href;
  } catch (e) {
    // keep raw src
  }

  const cells = [];

  const link = document.createElement('a');
  link.href = href;
  link.textContent = (iframe.getAttribute('title') || '').trim() || DEFAULT_TITLE;
  cells.push([link]);

  const height = iframeHeight(iframe);
  if (height) cells.push([height]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'embed-service', cells });
  element.replaceWith(block);
}
