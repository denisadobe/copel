/* eslint-disable */
/* global WebImporter */

import heroServiceParser from './parsers/hero-service.js';
import columnsIntroParser from './parsers/columns-intro.js';
import carouselCoverageParser from './parsers/carousel-coverage.js';
import cardsStepsParser from './parsers/cards-steps.js';
import cardsPlansParser from './parsers/cards-plans.js';
import accordionFaqParser from './parsers/accordion-faq.js';
import copelCleanupTransformer from './transformers/copel-cleanup.js';
import copelSectionsTransformer from './transformers/copel-sections.js';

const PAGE_TEMPLATE = {
  "name": "servico",
  "urls": [
    "https://www.copel.com/site/seguro-protege-casa/"
  ],
  "representativeUrl": "https://www.copel.com/site/seguro-protege-casa/",
  "description": "Service sale landing page (Seguro Protege Casa): anchor menu, hero, intro, coverages carousel, steps, plans/pricing, FAQ accordions",
  "blocks": [
    {
      "name": "hero-service",
      "instances": [
        ".elementor-element-b72699d"
      ]
    },
    {
      "name": "columns-intro",
      "instances": [
        ".elementor-element-7a475ea"
      ]
    },
    {
      "name": "carousel-coverage",
      "instances": [
        ".elementor-element-6ae60bb"
      ]
    },
    {
      "name": "cards-steps",
      "instances": [
        ".elementor-element-2ee91eb"
      ]
    },
    {
      "name": "cards-plans",
      "instances": [
        ".elementor-element-9d43412"
      ]
    },
    {
      "name": "accordion-faq",
      "instances": [
        ".elementor-element-9ea6f27",
        ".elementor-element-6654c7a",
        ".elementor-element-e7083e4",
        ".elementor-element-db819b2",
        ".elementor-element-4565a90",
        ".elementor-element-a3c74d3"
      ]
    }
  ],
  "urlPattern": "/site/*",
  "sections": [
    {
      "id": "rc2",
      "name": "Hero with in-page anchor menu",
      "selector": [
        "#topo"
      ],
      "style": null,
      "blocks": [
        "hero-service"
      ],
      "defaultContent": [
        ".elementor-element-e8d2453"
      ]
    },
    {
      "id": "rc3",
      "name": "Decorative seguro wordmark",
      "selector": [
        ".elementor-element-3822d4a"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".elementor-element-7762ced"
      ]
    },
    {
      "id": "rc4",
      "name": "Intro: Protecao para sua casa",
      "selector": [
        ".elementor-element-6117e01"
      ],
      "style": null,
      "blocks": [
        "columns-intro"
      ],
      "defaultContent": [
        ".elementor-element-d4595c9"
      ]
    },
    {
      "id": "rc5",
      "name": "Coverages carousel",
      "selector": [
        "#coberturas"
      ],
      "style": null,
      "blocks": [
        "carousel-coverage"
      ],
      "defaultContent": [
        ".elementor-element-2799aaf",
        ".elementor-element-cfce4d6"
      ]
    },
    {
      "id": "rc6",
      "name": "Contratacao simples (steps)",
      "selector": [
        ".elementor-element-3e260a4"
      ],
      "style": "centered",
      "blocks": [
        "cards-steps"
      ],
      "defaultContent": [
        ".elementor-element-db3db7a",
        ".elementor-element-a697370",
        ".elementor-element-560a2d2",
        ".elementor-element-91d9b2b",
        ".elementor-element-4504ce6"
      ]
    },
    {
      "id": "rc7",
      "name": "Promo banner O banheiro inundou",
      "selector": [
        ".elementor-element-45cea77"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".elementor-element-1bbe187"
      ]
    },
    {
      "id": "rc8",
      "name": "Plans / pricing",
      "selector": [
        "#planos"
      ],
      "style": "centered",
      "blocks": [
        "cards-plans"
      ],
      "defaultContent": [
        ".elementor-element-626227a",
        ".elementor-element-bca91a3"
      ]
    },
    {
      "id": "rc9",
      "name": "Promo banner Concorra a premios",
      "selector": [
        ".elementor-element-061249d"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".elementor-element-ed161c5"
      ]
    },
    {
      "id": "rc10",
      "name": "FAQ",
      "selector": [
        "#faq"
      ],
      "style": null,
      "blocks": [
        "accordion-faq"
      ],
      "defaultContent": [
        ".elementor-element-df4c116",
        ".elementor-element-664167c",
        ".elementor-element-c0db97c",
        ".elementor-element-5d76a9c",
        ".elementor-element-25e1b02",
        ".elementor-element-d6ec172"
      ]
    },
    {
      "id": "rc11",
      "name": "Copel Servicos brand band",
      "selector": [
        ".elementor-element-d53fdd7"
      ],
      "style": "light, centered",
      "blocks": [],
      "defaultContent": [
        ".elementor-element-c7c0764"
      ]
    }
  ]
};

const parsers = {
  'hero-service': heroServiceParser,
  'columns-intro': columnsIntroParser,
  'carousel-coverage': carouselCoverageParser,
  'cards-steps': cardsStepsParser,
  'cards-plans': cardsPlansParser,
  'accordion-faq': accordionFaqParser,
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
