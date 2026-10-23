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

N/A (Document Authoring project)

## Content structure

One row per slide:

| Cell 1 | Cell 2 |
| --- | --- |
| desktop picture, optional mobile picture | heading (title), optional paragraph(s), 1-2 links (primary / secondary CTA) |

## Headless source (AEM Content Fragments, optional)

Add 2-cell config rows at the top of the block. The first row must be `Fonte` (or `Source`); the
others are optional, in any order, right after it. Keys are case- and accent-insensitive. All config
rows are removed before rendering.

| Key | Value |
| --- | --- |
| `Fonte` / `Source` | Persisted query link or URL, e.g. `https://publish-p68716-e759339.adobeaemcloud.com/graphql/execute.json/copel/banners-por-canal;canal=site`. A relative path (`/graphql/execute.json/copel/banners-por-canal;canal=site`) uses `aem-publish-url` from `/config.json`. |
| `Público` / `Audience` | Sent as the `;publico=<value>` query variable when the URL does not already set it. |
| `Escopo Target` / `Target scope` | Adobe Target decision scope (see Personalization). |

Any slide rows after the config rows are the **fallback**. They render immediately (LCP is never
blocked) and are replaced by the Content Fragment slides when the query returns. They stay when the
fetch fails, times out (4 s), returns no active banners, or the URL is missing. Without fallback rows
a hero-height skeleton is shown; if no banners arrive the block is hidden.

The query runs as `GET` with `credentials: 'omit'`. The response is read from `data.bannerList.items`
(or `data.bannerByPath.item`).

### `banner` Content Fragment mapping

Each fragment produces the same DOM as an authored slide, so styling and behaviour are unchanged.

| CF field | Slide |
| --- | --- |
| `titulo` | heading (`h2`) |
| `resumo` (`plaintext` or string) | paragraph(s); a blank line starts a new paragraph |
| `imagem` | desktop picture: `_dynamicUrl` (Dynamic Media, gets `width`/`preferwebp` params), else `_publishUrl`, else `_path`. Relative values are prefixed with the query host |
| `imagemMobile` | mobile picture (optional) |
| `ctaTexto` / `ctaLink` | primary CTA |
| `ctaSecundarioTexto` / `ctaSecundarioLink` | secondary CTA (optional) |
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
banner moves to the first slide. If it is not in the list, it is fetched with
`copel/banner-por-path;path=<bannerPath>` from the same host and added in front. A
`decisioning.propositionDisplay` event then records the impression. On any failure the default order
is kept.
