# cards-news

Custom **cards** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

| Variation | Option class |
| --- | --- |
| No featured item | `no-featured` |
| Stacked featured (image above text) | `stacked` |

## Universal Editor fields

Model: `ue/models/blocks/cards-news.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Cards de notícias"; each row is an item "Notícia" (`cards-news-item`):
  - `image` (reference): Imagem (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo (`div:nth-child(1)>picture>img[alt]`)
  - `text` (richtext): Conteúdo (`div:nth-child(2)`) — Categoria (parágrafo antes do título), título H3 com link, data dd/mm/aaaa, resumo e link "Leia mais"
- Options (`classes`, multiselect, any of): `no-featured` (Sem destaque (todos iguais)), `stacked` (Destaque empilhado (imagem acima do texto))
