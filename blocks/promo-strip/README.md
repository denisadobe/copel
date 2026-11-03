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
- `.promo-strip:empty { display: none }`: anonymous visitors get no strip and no space.
- Signed-in visitors always get a strip (both experiences of the activity have one): the block
  adds `promo-strip-expected`, which holds a min-height from the first render (no layout shift),
  and the services cards stop overlapping the hero. Released after 6 s if no offer arrives.
- The offer fades in (opacity, 250 ms). Its markup (`.promo-strip__inner`, `.promo-strip__cta`)
  brings its own inline styles; the site CSS does not style the inside of the strip.
- `z-index` capped at 1 (below the sticky header), even if the offer forces one on `#promo-strip`.
- at.js starts inline in `head.html` (no body hiding), with the profile parameters
  `copel_logado` / `copel_comprou_seguro` read synchronously from the sign-in cookie and the
  stored purchase state (`scripts/target-profile.js`, localStorage).
