# cards-services

Custom **cards** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

| Variation | Option class |
| --- | --- |
| Compact (icon beside label) | `compact` |

## Universal Editor fields

Model: `ue/models/blocks/cards-services.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Cards de serviços"; each row is an item "Serviço" (`cards-services-item`):
  - `image` (reference): Ícone (SVG ou imagem) (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo do ícone (`div:nth-child(1)>picture>img[alt]`)
  - `text` (richtext): Rótulo (`div:nth-child(2)`) — Rótulo com link e, opcionalmente, um segundo link "Veja mais"
- Options (`classes`, select, one of): none (Padrão (ícone acima)), `compact` (Compacto (ícone ao lado do rótulo))
