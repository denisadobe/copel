# carousel-quicklinks

Custom **carousel** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/carousel-quicklinks.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Carrossel de atalhos"; each row is an item "Atalho" (`carousel-quicklinks-item`):
  - `image` (reference): Ícone (SVG ou imagem) (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo do ícone (`div:nth-child(1)>picture>img[alt]`)
  - `text` (richtext): Rótulo (`div:nth-child(2)`) — Rótulo com link
