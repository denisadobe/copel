# hero-service

Custom **hero** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/hero-service.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- `image` (reference): Imagem de fundo (`div:nth-child(1)>div>picture>img[src]`)
- `imageAlt` (text): Texto alternativo (`div:nth-child(1)>div>picture>img[alt]`)
- `text` (richtext): Conteúdo (`div:nth-child(2)>div`) — Título (H1), linhas de texto e link de chamada
- `asideImage` (reference): Imagem lateral 1 (opcional, ex.: logo do produto) (`div:nth-child(3)>div>picture>img[src]`)
- `asideImageAlt` (text): Texto alternativo (lateral 1) (`div:nth-child(3)>div>picture>img[alt]`)
- `asideImage2` (reference): Imagem lateral 2 (opcional, ex.: selo de preço) (`div:nth-child(3)>div>picture:nth-of-type(2)>img[src]`)
- `asideImage2Alt` (text): Texto alternativo (lateral 2) (`div:nth-child(3)>div>picture:nth-of-type(2)>img[alt]`)
