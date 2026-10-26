# cards-plans

Custom **cards** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/cards-plans.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Cards de planos"; each row is an item "Plano" (`cards-plans-item`):
  - `header` (richtext): Cabeçalho (`div:nth-child(1)`) — Selo opcional (parágrafo antes do título), nome do plano (H3), preço em negrito e observação
  - `cta` (richtext): Botão de contratação (`div:nth-child(2)`) — Link do botão principal
  - `coverages` (richtext): Coberturas (`div:nth-child(3)`) — Lista; item riscado = não incluso
  - `details` (richtext): Detalhes e notas (opcional) (`div:nth-child(4)`)
  - `sku` (text): SKU no Commerce (opcional) (`div:nth-child(5)`) — Ex.: protege-casa-basico. Com SKU, o botão abre a contratação expressa
