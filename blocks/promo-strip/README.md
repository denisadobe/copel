# promo-strip

Empty slot for a promotion strip filled by **Adobe Target** (at.js, VEC activity
`Copel | Site | Promo por jornada (VEC XT)`). Home page, right below the main banner (same section).

## Authoring (Document Authoring)

A block table with only the header row `Promo Strip`. Any rows are dropped: the strip has no
default content (anonymous visitors see nothing).

## Supported variations

No variations.

## Universal Editor fields

Model: `ue/models/blocks/promo-strip.json` (bundled into the root `component-*.json` by `npm run build:json`). No fields;
in the editor a dashed placeholder shows where Target puts the strip.

## Behaviour

- The block gets `id="promo-strip"`, the selector of the VEC activity. Do not rename it.
- `.promo-strip:empty { display: none }`: no strip and no space until Target fills it.
- While at.js waits for Target only the strip is hidden (`targetGlobalSettings.bodyHiddenStyle`
  in `head.html`), never the page.

Markup injected by Target:

```html
<div class="promo-strip__inner">
  <strong>título</strong>
  <span>texto</span>
  <a class="promo-strip__cta" href="...">botão</a>
</div>
```

One line on desktop (title, text, button on the right), stacked on mobile. Orange background
`--copel-orange` (#F5821E), text `--copel-ink` (#151C21), button `--copel-orange-ink` (#C85000)
with white text.
