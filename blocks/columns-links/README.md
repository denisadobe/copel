# columns-links

Custom **columns** block. Purpose: link directory band above the global footer (up to 5 link columns).

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, N cells (one per column). Each cell: a heading (H3, may be a link) followed by a bulleted list of links. A cell without a heading still renders its list; empty cells are ignored; more than 5 cells wrap to a new row on desktop.

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/columns-links.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Columns block (`behaviour: columns`): rows `columns-links-row`, cells `columns-links-cell`; each cell holds Text and Image components, so cells may be in any order.
- `columns` (number): Número de colunas (default 5)
