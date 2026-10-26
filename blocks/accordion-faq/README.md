# accordion-faq

Custom **accordion** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

| Variation | Option class |
| --- | --- |
| Single open (one item at a time) | `single-open` |

## Universal Editor fields

Model: `ue/models/blocks/accordion-faq.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Perguntas frequentes (FAQ)"; each row is an item "Pergunta" (`accordion-faq-item`):
  - `question` (text): Pergunta (`div:nth-child(1)`)
  - `answer` (richtext): Resposta (`div:nth-child(2)`)
- Options (`classes`, select, one of): none (Várias abertas ao mesmo tempo), `single-open` (Uma aberta por vez)
