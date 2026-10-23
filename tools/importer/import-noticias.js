/* eslint-disable */
/* global WebImporter */

import cardsNewsParser from './parsers/cards-news.js';
import copelCleanupTransformer from './transformers/copel-cleanup.js';
import copelSectionsTransformer from './transformers/copel-sections.js';

const PAGE_TEMPLATE = {
  "name": "noticias",
  "urls": [
    "https://www.copel.com/site/noticias/"
  ],
  "representativeUrl": "https://www.copel.com/site/noticias/",
  "description": "News listing: page banner, featured news card, news grid with sidebar (Webséries, press office)",
  "blocks": [
    {
      "name": "cards-news",
      "instances": [
        ".elementor-element-72046274",
        ".elementor-element-fe6c3a8"
      ]
    }
  ],
  "urlPattern": "/site/*",
  "sections": [
    {
      "id": "rc2",
      "name": "Page banner",
      "selector": [
        ".elementor-element-4ef813c3"
      ],
      "style": "page-banner",
      "blocks": [],
      "defaultContent": [
        ".elementor-element-60b04e32"
      ]
    },
    {
      "id": "rc3",
      "name": "Featured news item",
      "selector": [
        ".elementor-element-50c10c7"
      ],
      "style": null,
      "blocks": [
        "cards-news"
      ],
      "defaultContent": []
    },
    {
      "id": "rc4",
      "name": "News list with sidebar",
      "selector": [
        ".elementor-element-425a7445"
      ],
      "style": "split",
      "blocks": [
        "cards-news"
      ],
      "defaultContent": [
        ".elementor-element-1ee28de1",
        ".elementor-element-14032477",
        ".elementor-element-4a19e926"
      ]
    }
  ]
};

const parsers = {
  'cards-news': cardsNewsParser,
};

const transformers = [copelCleanupTransformer, copelSectionsTransformer];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    });
  });
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // Copel pages live under /site/ on the source; strip that prefix.
    const rawPath = new URL(params.originalURL).pathname
      .replace(/^\/site(?=\/|$)/, '')
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
