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
| `Fonte` / `Source` | Where the banner list comes from (see below). |
| `Público` / `Audience` | Forces the audience (`publicoAtual`) instead of detecting it, e.g. `cliente-protege-casa` for previews. |
| `Escopo Target` / `Target scope` | Adobe Target decision scope (see Personalization). |

`Fonte` values:

| Value | Request |
| --- | --- |
| Absolute URL on another host, e.g. the app proxy `https://<app-domain>/api/banners?canal=site` or `https://publish-p68716-e759339.adobeaemcloud.com/graphql/execute.json/global/banners-por-canal;canal=site` | Fetched exactly as written (nothing is appended) |
| A channel (`site`, `app`) or empty | `aem-banners-url` from `/config.json` with `{canal}` replaced, e.g. `"https://<app-domain>/api/banners?canal={canal}"`. Without that key: `<aem-publish-url>/graphql/execute.json/global/banners-por-canal;canal=<canal>` |
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

The query does not filter by audience; the block does. A banner is kept when its `publico` is
empty, `todos`, or equal to the current audience:

- `visitante` (default).
- `cliente-protege-casa` when the Commerce session cookie `auth_dropin_user_token` exists and the
  customer has an order line whose `product_sku` starts with `protege-casa-`. The block checks this
  itself, without loading the drop-ins. It sends a `POST` to `commerce-core-endpoint` with the store
  headers from `/config.json` (`headers.all` and `headers.cs`) plus `Authorization: Bearer <token>`,
  using the query `{ customer { orders(pageSize: 20) { items { items { product_sku } } } } }`, with a
  2.5 s timeout.
- The check runs in parallel with the banner fetch. The result is cached in `sessionStorage`
  (`carousel-hero-publico`) under a fingerprint of the token, never the token itself, so a new login
  re-checks. On any error or timeout the audience is `visitante`, and that result is not cached.
- A `Público` config row overrides the detected audience.

The block exposes the audience it used as `data-publico` (alongside `data-source="content-fragments"`).

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
