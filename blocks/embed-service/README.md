# embed-service

Custom **embed** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/embed-service.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- `url` (text): URL do serviço (`div:nth-child(1)>div a[href]`) — Endereço https da página incorporada
- `title` (text): Título do iframe (`div:nth-child(1)>div a`) — Texto do link; também é o nome acessível do iframe
- `height` (text): Altura (`div:nth-child(2)>div`) — Ex.: 850px (padrão 800px)
