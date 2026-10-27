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
- `fonte` (text): Fonte (Content Fragments) (`div:nth-child(1):not(:has(picture, h1, h2, h3, h4, h5, h6))>div:nth-child(2)`) — site / app / URL da persisted query ou da ponte do app; vazio = slides autorados
- `publico` (select): Público (`div:nth-child(2):not(:has(picture, h1, h2, h3, h4, h5, h6))>div:nth-child(2)`) — Público dos banners; vazio = visitante
- `escopoTarget` (text): Escopo Target (`div:nth-child(3):not(:has(picture, h1, h2, h3, h4, h5, h6))>div:nth-child(2)`) — Decision scope do Adobe Target (opcional)
- Options (`classes`, select, one of): none (Com autoplay), `no-autoplay` (Sem autoplay)

The block fields `fonte`, `publico` and `escopoTarget` are the value cells of the config rows
`Fonte`, `Público` and `Escopo Target` (rows 1-3). A block inserted from the editor already has the
three rows (empty values) plus one slide. Selectors only match a config row (no picture or heading),
so they never touch a slide: on a block that has only the `Fonte` row (e.g. the home page), add the
`Público` and `Escopo Target` rows once in the document editor to edit them in the properties panel.
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
- Each CF slide also has an "Editar no AEM" link (new tab) to the Content Fragment editor:
  `<author>/ui#/aem/cf/editor/editor<_path>`, or the config.json template `aem-cf-editor-url`
  (`{author}`, `{path}`; e.g. `{author}/editor.html{path}` for the classic editor).
- Live updates (`ue/scripts/ue.js`): `aue:content-patch` and `aue:content-update` for
  `urn:aemconnection:` resources update the slide in place (text, link, alt, image from the DAM
  path on the publish host) and cancel the default page reload, since the published source does
  not show unpublished author changes; `aue:content-details` applies the author text values when a
  fragment is opened in the panel. DA (`urn:ab:`) events keep the default behavior.
- The authored slides stay in the DOM, hidden (`div.carousel-hero-fallback`, labelled "Slide
  (fallback autorado)"); when the fetch fails they stay visible and the badge says so. The DA block
  instrumentation (block fields `Fonte` / `Público` / `Escopo Target`) is unchanged.
- Badge (editor only): "Banners de Content Fragments do AEM — clique no slide para editar no
  painel, ou use "Editar no AEM"".
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

Add 2-cell config rows at the top of the block, in any order (the first row must be one of them).
Keys are case-, accent-, space- and dash-insensitive (`Escopo Target`, `escopo-target` and the
editor field name `escopoTarget` are the same key). All config rows are removed before rendering.
Content Fragments are only used when `Fonte` has a value; an empty `Fonte` (as in a block inserted
from the Universal Editor) means authored slides only.

| Key | Value |
| --- | --- |
| `Fonte` / `Source` | Where the banner list comes from (see below). |
| `Público` / `Audience` | Audience whose banners are shown (default `visitante`), e.g. `cliente-protege-casa` to preview the upsell. |
| `Escopo Target` / `Target scope` | Adobe Target decision scope (see Personalization). |

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
`data.bannerList.items` (or `data.bannerByPath.item`).

### Audience (`publico`)

There is no per-person logic in the block. The query does not filter by audience; the block keeps a
banner when its `publico` is empty, `todos`, or equal to the audience in use:

- `visitante` by default, so the Protege Casa banner shows and the `cliente-protege-casa` upsell
  stays out;
- or the value of an authored `Público` config row.

Choosing a banner per person (for example the Protege Vida upsell for customers) is meant for Adobe
Target through the optional `Escopo Target` row; a banner chosen by Target is shown whatever its
`publico`. The block exposes the audience it used as `data-publico` (alongside
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

### Personalization (Adobe Target via Web SDK)

This does nothing unless a `Target scope` is set and `window.alloy` exists. The block calls
`alloy('sendEvent', { decisionScopes: [scope], renderDecisions: false })` with a 1.5 s timeout and
reads the first proposition item's JSON, `{ "bannerPath": "/content/dam/copel/banners/..." }`. That
banner moves to the first slide. If it is not in the list, it is fetched and added in front, after the
same date and audience filters. The fetch goes to:

- `global/banner-por-path;path=<bannerPath>` on the same endpoint as the list query. AEM does not
  decode `%2F`, so the validated path is sent raw.
- `aem-publish-url` when the list comes from a proxy.
- `aem-banner-by-path-url` from `/config.json` (template with `{path}`) when it is set, for example
  to go through the app proxy.

A `decisioning.propositionDisplay` event then records the impression. On any failure the default
order is kept.
