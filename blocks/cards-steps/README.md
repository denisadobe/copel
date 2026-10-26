# cards-steps

Custom **cards** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/cards-steps.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Passo a passo"; each row is an item "Passo" (`cards-steps-item`):
  - `image` (reference): Ícone (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo (`div:nth-child(1)>picture>img[alt]`)
  - `text` (richtext): Conteúdo (`div:nth-child(2)`) — Título do passo (H3) e descrição
