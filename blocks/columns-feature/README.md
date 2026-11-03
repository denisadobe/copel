# columns-feature

Custom **columns** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

| Variation | Option class |
| --- | --- |
| Dark panel | `dark` |
| Reverse (swap image side) | `reverse` |

## Universal Editor fields

Model: `ue/models/blocks/columns-feature.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Columns block (`behaviour: columns`): rows `columns-feature-row`, cells `columns-feature-cell`; each cell holds Text and Image components, so cells may be in any order.
- Options (`classes`, single select with a real "padrao" (Padrão) value, combinations as their own options: a block with no class at all makes the editor fail on the next style change): `padrao` (Padrão), `dark` (Painel escuro), `reverse` (Inverter lado
  da imagem), `dark reverse`
- `columns` (number): Número de colunas (default 2)
