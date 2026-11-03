# carousel-hero

Custom **carousel** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

| Variation | Option class |
| --- | --- |
| No autoplay | `no-autoplay` |

## Universal Editor fields

Model: `ue/models/blocks/carousel-hero.json` (bundled into the root `component-*.json` by `npm run build:json`). Universal Editor on Author Bus (`*.ue.da.live`); the content stays the same DA table.

- Container "Carrossel hero (banners)"; each row is an item "Slide" (`carousel-hero-item`):
  - `image` (reference): Imagem (desktop) (`div:nth-child(1)>picture>img[src]`)
  - `imageAlt` (text): Texto alternativo (`div:nth-child(1)>picture>img[alt]`)
  - `imageMobile` (reference): Imagem mobile (opcional) (`div:nth-child(1)>picture:nth-of-type(2)>img[src]`)
  - `imageMobileAlt` (text): Texto alternativo (mobile) (`div:nth-child(1)>picture:nth-of-type(2)>img[alt]`)
  - `text` (richtext): Conteúdo (`div:nth-child(2)`) — Título (H2), texto opcional e até 2 links: o 1º é o botão principal, o 2º o secundário
- Origem dos slides (`classes`, single select with a real "padrao" (Padrão) value, combinations as their own options: a block with no class at all makes the editor fail on the next style change): `padrao` (Slides autorados), `banners-site` /
  `banners-app` (Banners do AEM, canal site / app: the slides come from the banner Content
  Fragments), each also with `no-autoplay` (Sem autoplay)

The banner source is a block option, not a config row, so the page HTML (what AI agents read)
holds no "Fonte / site" text, only slides. With `banners-<channel>` the authored slides are a copy
of the public banners: `node tools/banners-copy/banners-copy.mjs --write` rewrites them from the
banner list (anonymous audience, active, by `ordem`; images resized via Dynamic Media and stored
in DA `/images/banners/`), updates DA and previews the page (not live). Run it again after the
banners change if the copy should match. On the site and in the editor the Content Fragments
replace the copy; it only shows when the fetch fails. A `Fonte` config row (below) still works in
DA but is no longer an editor field.
In the editor's content tree the config rows are listed as item resources by Author Bus; the block
removes them from the page, so only real slides are shown and selectable.

In the editor (`IS_UE`, `scripts/ue-utils.js`):

- With a `Fonte`, the Content Fragment slides are rendered from the same published source as the
  site and edited **in context in AEM** through a second editor connection:
  `ue/scripts/ue.js` adds `<meta name="urn:adobe:aue:system:aemconnection"
  content="aem:<aem-author-url>">` (config.json `aem-author-url`, else derived from
  `aem-publish-url`) next to the Author Bus connection (`urn:adobe:aue:system:ab`).
- Each CF slide is `data-aue-resource="urn:aemconnection:<_path>/jcr:content/data/master"`,
  `data-aue-type="reference"`, `data-aue-filter="cf"`, `data-aue-label="Banner: <titulo>"`, with
  inline props (inheriting that resource) `titulo` (h2, text), `resumo` (one plain multi-line `p`,
  text), `ctaTexto` / `ctaSecundarioTexto` (links, text), `imagem` / `imagemMobile` (img, media).
  Selecting a slide shows the fragment's model fields in the properties panel (saved to AEM author).
- Live updates (`ue/scripts/ue.js`): `aue:content-patch` and `aue:content-update` for
  `urn:aemconnection:` resources update the slide in place (text, link, alt, image from the DAM
  path on the publish host) and stop the event before the editor's own handler (raw value / DAM
  path swapped in, or a reload showing the published value again), since the published source
  does not show unpublished author changes; `aue:content-details` applies the author text values
  when a fragment is opened in the panel. DA (`urn:ab:`) edits re-render the block from the
  saved content (`ue/scripts/ue.js`).
- The authored slides stay in the DOM, hidden (`div.carousel-hero-fallback`, labelled "Slide
  (fallback autorado)"); when the fetch fails they stay visible and the badge says so. The DA block
  options stay editable.
- While the CF slides are shown the block is `data-aue-type="component"` (no filter) instead of a
  container: the editor treats every resource under a container as a page component, so it would
  offer remove / duplicate / move on a fragment slide and fail ("Component not found"). A banner
  leaves the home in AEM (unpublish it, or `ativoAte` in the past), not in the page. When the fetch
  fails the block stays a container (authored slides can be added and removed).
- No editor badge while the fragments load or show (the fragment opens in the Content Fragment
  editor from the editor's own panel); only a failure shows one, over the authored copy.
- Autoplay is off; selecting a slide in the editor shows it (`ue/scripts/ue.js`).
- A slide just added (still empty) is kept as an empty slide.
- The height is capped in px (`clamp()`), never a pure `vh`, so it stays stable while the editor
  resizes its iframe.

## Content structure

One row per slide:

| Cell 1 | Cell 2 |
| --- | --- |
| desktop picture, optional mobile picture | heading (title), optional paragraph(s), 1-2 links (primary / secondary CTA) |

## Headless source (AEM Content Fragments, optional)

The block option `banners-site` / `banners-app` (editor: Opções > Banners do AEM) is the usual
way. A 2-cell config row at the top of the block, `Fonte` / `Source` (case-, accent-, space- and
dash-insensitive), also works and allows the other values below; it is removed before rendering.
Without either, the block shows its authored slides only.

`Fonte` values:

| Value | Request |
| --- | --- |
| Absolute URL on another host, e.g. the app proxy `https://<app-domain>/api/banners?canal=site` or `https://publish-p68716-e759339.adobeaemcloud.com/graphql/execute.json/global/banners-por-canal;canal=site` | Fetched exactly as written (nothing is appended) |
| A channel (`site`, `app`) | `aem-banners-url` from `/config.json` with `{canal}` replaced, e.g. `"https://<app-domain>/api/banners?canal={canal}"`. Without that key: `<aem-publish-url>/graphql/execute.json/global/banners-por-canal;canal=<canal>` |
| A persisted-query path, e.g. `/graphql/execute.json/global/banners-por-canal;canal=site` or `global/banners-por-canal;canal=site` | On `aem-publish-url` from `/config.json` |

The AEM publish tier sends no CORS headers for `*.aem.page` / `*.aem.live`, and none on the
CDN-cached GET for localhost either. Browsers therefore need the app proxy URL (or an
`aem-banners-url` pointing at it). Direct publish URLs only work server-side or behind a proxy.

Any slide rows after the config rows are the **fallback**. They render immediately (LCP is never
blocked) and are replaced by the Content Fragment slides when the list returns. They stay when the
fetch fails, times out (4 s), returns no matching banners, or the source cannot be resolved. Without
fallback rows a hero-height skeleton is shown; if no banners arrive the block is hidden.

The list is fetched as `GET` with `credentials: 'omit'`. The response is read from
`data.bannerList.items`.

### Audience (`publico`)

No personalization in the block (Adobe Target only fills the promo strip below the hero). The
query does not filter by audience; the block keeps a banner when its `publico` is empty, `todos`
or `visitante`, so a banner for another audience (the `cliente-protege-casa` upsell) stays out.
Without the `publico` field every published banner shows. The block exposes `data-publico` (alongside
`data-source="content-fragments"`).

### `banner` Content Fragment mapping

Each fragment produces the same DOM as an authored slide, so styling and behaviour are unchanged.

| CF field | Slide |
| --- | --- |
| `titulo` | heading (`h2`) |
| `resumo` (`plaintext` or string) | paragraph(s); a blank line starts a new paragraph |
| `imagem` | desktop picture. jpg is an ImageRef (`_publishUrl`, `_dynamicUrl`, `width`, `height`); webp is a DocumentRef (`_path`, `_publishUrl`). Uses `_publishUrl`, else `aem-publish-url` + `_path`, else `_dynamicUrl` with `width`/`preferwebp` params |
| `imagemMobile` | mobile picture (optional) |
| `imagemAlt` | image alt text (optional) |
| `ctaTexto` / `ctaLink` | primary CTA |
| `ctaSecundarioTexto` / `ctaSecundarioLink` | secondary CTA (optional) |
| `publico` | audience filter (see above) |
| `ordem` | ascending order (fragments without it go last) |
| `ativoDe` / `ativoAte` | shown only inside this window when set (a date-only `ativoAte` includes that day) |
| `canais` | filtered by the query (`;canal=site`) |
| `_path` | `data-cf-path` attribute on the slide (analytics/debug) |

CF data is written with `textContent` and `createElement` only, never `innerHTML` (the site CSP
enforces Trusted Types). Links must be `http(s)` or site-relative (`/…`), otherwise they are dropped.
