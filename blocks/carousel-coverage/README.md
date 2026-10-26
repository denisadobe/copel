# carousel-coverage

Custom **carousel** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/carousel-coverage.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Carrossel de coberturas"; each row is an item "Cobertura" (`carousel-coverage-item`):
  - `image` (reference): Foto (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo (`div:nth-child(1)>picture>img[alt]`)
  - `text` (richtext): Conteúdo (`div:nth-child(2)`) — Etiquetas de plano (parágrafo só com links), título (H3) e descrição
