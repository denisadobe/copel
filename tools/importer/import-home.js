/* eslint-disable */
/* global WebImporter */

import carouselHeroParser from './parsers/carousel-hero.js';
import cardsServicesParser from './parsers/cards-services.js';
import cardsNewsParser from './parsers/cards-news.js';
import columnsAppParser from './parsers/columns-app.js';
import cardsAudienceParser from './parsers/cards-audience.js';
import columnsFeatureParser from './parsers/columns-feature.js';
import carouselQuicklinksParser from './parsers/carousel-quicklinks.js';
import columnsLinksParser from './parsers/columns-links.js';
import copelCleanupTransformer from './transformers/copel-cleanup.js';
import copelSectionsTransformer from './transformers/copel-sections.js';

const PAGE_TEMPLATE = {
  "name": "home",
  "urls": [
    "https://www.copel.com/site/"
  ],
  "representativeUrl": "https://www.copel.com/site/",
  "description": "Copel home page: hero banner carousel, quick services, news, app promo, audience tiles, feature panels, quick links",
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        ".elementor-element-7fd830f6",
        ".elementor-widget-slides.anunciosHome"
      ]
    },
    {
      "name": "cards-services",
      "instances": [
        ".elementor-element-f449e99"
      ]
    },
    {
      "name": "cards-news",
      "instances": [
        ".elementor-element-ae6699a"
      ]
    },
    {
      "name": "columns-app",
      "instances": [
        ".elementor-element-db01c2f"
      ]
    },
    {
      "name": "cards-audience",
      "instances": [
        ".elementor-element-caea78d"
      ]
    },
    {
      "name": "columns-feature",
      "instances": [
        ".elementor-element-d58124b",
        ".elementor-element-0873ed7",
        ".elementor-element-b803038",
        ".elementor-element-a0b2ffc",
        ".elementor-element-05b7424"
      ]
    },
    {
      "name": "carousel-quicklinks",
      "instances": [
        ".elementor-element-b566fc0",
        ".elementor-widget-reviews"
      ]
    },
    {
      "name": "columns-links",
      "instances": [
        ".elementor-element-a75d5f3"
      ]
    }
  ],
  "urlPattern": "/*",
  "sections": [
    {
      "id": "rc2",
      "name": "Hero banner carousel",
      "selector": [
        ".elementor-element-49bcabf3"
      ],
      "style": null,
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "rc3",
      "name": "Quick services",
      "selector": [
        ".elementor-element-d8408d9"
      ],
      "style": "centered",
      "blocks": [
        "cards-services"
      ],
      "defaultContent": [
        ".elementor-element-2b2e421"
      ]
    },
    {
      "id": "rc5",
      "name": "News",
      "selector": [
        ".elementor-element-87273e0",
        ".elementor-element-ae6699a",
        "#aplicativo"
      ],
      "style": "centered",
      "blocks": [
        "cards-news"
      ],
      "defaultContent": [
        ".elementor-element-9158681",
        ".elementor-element-e1e198c",
        ".elementor-element-606f175"
      ]
    },
    {
      "id": "rc7",
      "name": "Aplicativo Copel",
      "selector": [
        ".elementor-element-db01c2f"
      ],
      "style": null,
      "blocks": [
        "columns-app"
      ],
      "defaultContent": []
    },
    {
      "id": "rc8",
      "name": "Para sua casa / Para sua empresa",
      "selector": [
        ".elementor-element-caea78d"
      ],
      "style": null,
      "blocks": [
        "cards-audience"
      ],
      "defaultContent": []
    },
    {
      "id": "rc9",
      "name": "A Copel",
      "selector": [
        ".elementor-element-d58124b"
      ],
      "style": null,
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "rc11",
      "name": "Sustentabilidade e Inovacao",
      "selector": [
        ".elementor-element-0873ed7"
      ],
      "style": null,
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "rc12",
      "name": "Educacao",
      "selector": [
        ".elementor-element-b803038"
      ],
      "style": null,
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "rc13",
      "name": "Mercado livre",
      "selector": [
        ".elementor-element-a0b2ffc"
      ],
      "style": null,
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "rc14",
      "name": "Carreira",
      "selector": [
        ".elementor-element-05b7424"
      ],
      "style": null,
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "rc15",
      "name": "Quick links carousel",
      "selector": [
        ".elementor-element-425e15d"
      ],
      "style": null,
      "blocks": [
        "carousel-quicklinks"
      ],
      "defaultContent": []
    },
    {
      "id": "rc16",
      "name": "Link directory (above footer)",
      "selector": [
        ".elementor-element-a75d5f3"
      ],
      "style": "light",
      "blocks": [
        "columns-links"
      ],
      "defaultContent": []
    }
  ]
};

const parsers = {
  'carousel-hero': carouselHeroParser,
  'cards-services': cardsServicesParser,
  'cards-news': cardsNewsParser,
  'columns-app': columnsAppParser,
  'cards-audience': cardsAudienceParser,
  'columns-feature': columnsFeatureParser,
  'carousel-quicklinks': carouselQuicklinksParser,
  'columns-links': columnsLinksParser,
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
