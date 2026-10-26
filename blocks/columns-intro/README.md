# columns-intro

Custom **columns** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/columns-intro.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Columns block (`behaviour: columns`): rows `columns-intro-row`, cells `columns-intro-cell`; each cell holds Text and Image components, so cells may be in any order.
- `columns` (number): Número de colunas (default 3)
