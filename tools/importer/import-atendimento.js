/* eslint-disable */
/* global WebImporter */

import embedServiceParser from './parsers/embed-service.js';
import copelCleanupTransformer from './transformers/copel-cleanup.js';
import copelSectionsTransformer from './transformers/copel-sections.js';

const PAGE_TEMPLATE = {
  "name": "atendimento",
  "urls": [
    "https://www.copel.com/site/copel-distribuicao/falta-de-luz/"
  ],
  "representativeUrl": "https://www.copel.com/site/copel-distribuicao/falta-de-luz/",
  "description": "Customer service page: title, embedded Copel self-service app (iframe) beside instructions for other channels",
  "blocks": [
    {
      "name": "embed-service",
      "instances": [
        ".elementor-element-5f821cf",
        ".elementor-widget-html:has(iframe[src*=\"copel.com/slwweb\"])"
      ]
    }
  ],
  "urlPattern": "/site/copel-distribuicao/*",
  "sections": [
    {
      "id": "rc2",
      "name": "Page title",
      "selector": [
        ".elementor-element-cc298da"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".elementor-element-5d590316"
      ]
    },
    {
      "id": "rc3",
      "name": "Outage self-service app with alternative channels",
      "selector": [
        ".elementor-element-cb2c92f"
      ],
      "style": "split",
      "blocks": [
        "embed-service"
      ],
      "defaultContent": [
        ".elementor-element-14a69eaf",
        ".elementor-element-273dca5b",
        ".elementor-element-54c3a3c",
        ".elementor-element-1f8649cb"
      ]
    }
  ]
};

const parsers = {
  'embed-service': embedServiceParser,
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
