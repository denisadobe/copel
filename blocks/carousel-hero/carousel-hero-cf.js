/* eslint-disable no-underscore-dangle -- AEM GraphQL fields (_path, _publishUrl, _dynamicUrl) */
/*
 * carousel-hero: AEM headless source (banner Content Fragments).
 * Loaded on demand by carousel-hero.js only when the block has a "Fonte"/"Source" config row
 * (the request of an absolute Fonte URL is already started by carousel-hero.js).
 *
 * Turns each `banner` Content Fragment into a row with exactly the authored structure
 * (cell 1: picture(s), cell 2: h2 + p + p>a), so carousel-hero.js decorates it unchanged.
 * DOM is built with createElement/textContent only (CSP: require-trusted-types-for 'script').
 *
 * Source resolution (Fonte value):
 *   - absolute URL on another host (e.g. the app proxy https://<app>/api/banners?canal=site)
 *     -> fetched exactly as written
 *   - bare channel ("site", "app") or empty -> config.json `aem-banners-url` template
 *     ("…?canal={canal}"), else <aem-publish-url>/graphql/execute.json/global/banners-por-canal
 *   - path (/graphql/execute.json/…, global/banners-por-canal;canal=site) -> on aem-publish-url
 *
 * Audience: no personalization rules in code. Banners are kept when publico is empty, "todos" or
 * the default audience ("visitante"); an authored "Público" row changes that audience. Choosing
 * a banner per person (e.g. the Protege Vida upsell for Protege Casa customers) is left to Adobe
 * Target via the optional "Escopo Target" row: the visitor's Commerce facts go as mbox
 * parameters (scripts/target-profile.js) and the JSON offer names the banner shown first
 * ("bannerPath") and the ones hidden ("ocultar").
 */

const FETCH_TIMEOUT_MS = 4000;
const ALLOY_TIMEOUT_MS = 1500;
const AEM_QUERY_PREFIX = '/graphql/execute.json/global/';
const LIST_QUERY = 'banners-por-canal';
const BY_PATH_QUERY = 'banner-por-path';
const DEFAULT_CHANNEL = 'site';
const DEFAULT_AUDIENCE = 'visitante';
// same cache key/shape as scripts/commerce.js getConfig(), so the page fetches /config.json once
const CONFIG_CACHE_KEY = 'commerce-config';
const CONFIG_TTL_S = 7200;

let configPromise;

function readCachedConfig() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CONFIG_CACHE_KEY));
    if (cached && cached[':expiry'] > Date.now() / 1000) return cached;
  } catch (e) {
    // ignore malformed cache
  }
  return null;
}

/**
 * Uses a /config.json request already started by carousel-hero.js (scripts/commerce-session.js
 * getStorefrontConfig, same session cache) as the page's site config.
 * @param {Promise<object|null>} [request] full config.json
 */
function primeSiteConfig(request) {
  if (configPromise || !request) return;
  configPromise = request.then((config) => config?.public?.default || {}, () => ({}));
}

/** Site config (/config.json, public.default), cached per session and per page. */
function getSiteConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const cached = readCachedConfig();
      if (cached?.public?.default?.['aem-publish-url']) return cached.public.default;
      try {
        const resp = await fetch(`${window.location.origin}/config.json`);
        if (!resp.ok) return {};
        const config = await resp.json();
        config[':expiry'] = Math.round(Date.now() / 1000) + CONFIG_TTL_S;
        try {
          sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
        } catch (e) {
          // storage full / disabled
        }
        return config?.public?.default || {};
      } catch (e) {
        return {};
      }
    })();
  }
  return configPromise;
}

const isHttp = (url) => url.protocol === 'http:' || url.protocol === 'https:';

function toHttpUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    return isHttp(url) ? url : null;
  } catch (e) {
    return null;
  }
}

async function getPublishOrigin() {
  return toHttpUrl((await getSiteConfig())['aem-publish-url'])?.origin || null;
}

/**
 * AEM author origin (Universal Editor only): config.json `aem-author-url`, else derived from
 * `aem-publish-url` (publish-pX-eY -> author-pX-eY).
 */
export async function getAuthorOrigin() {
  const config = await getSiteConfig();
  const author = toHttpUrl(config['aem-author-url'])?.origin;
  if (author) return author;
  const publish = toHttpUrl(config['aem-publish-url']);
  return publish && /^publish-/.test(publish.hostname)
    ? `${publish.protocol}//${publish.hostname.replace(/^publish-/, 'author-')}`
    : null;
}

/** AEM publish origin, for images of Content Fragments edited in the Universal Editor. */
export const getAssetOrigin = getPublishOrigin;

/**
 * Content Fragment editor link for a fragment path (Universal Editor only): config.json
 * `aem-cf-editor-url` template ({author}, {path}), else the new CF editor on the author host
 * (<author>/ui#/aem/cf/editor/editor<path>, which opens it in the Experience Cloud shell).
 * The classic editor would be "{author}/editor.html{path}".
 */
export async function getCfEditorUrl(path) {
  const author = await getAuthorOrigin();
  if (!author || typeof path !== 'string' || !path.startsWith('/content/dam/')) return null;
  const template = (await getSiteConfig())['aem-cf-editor-url'];
  const url = typeof template === 'string' && template
    ? template.replace(/\{author\}/g, author).replace(/\{path\}/g, path)
    : `${author}/ui#/aem/cf/editor/editor${path}`;
  return toHttpUrl(url)?.href || null;
}

const isPersistedQuery = (url) => url.pathname.includes('/graphql/execute.json/');

/** URL to fetch the banner list from (see header comment); null when unresolvable. */
async function resolveSourceUrl(rawValue) {
  const value = (rawValue || '').trim();

  // bare channel or empty: config template, else the AEM persisted query
  if (!value || /^[a-z][\w-]*$/i.test(value)) {
    const channel = value || DEFAULT_CHANNEL;
    const template = (await getSiteConfig())['aem-banners-url'];
    if (typeof template === 'string' && template) {
      return toHttpUrl(template.replace(/\{canal\}/g, encodeURIComponent(channel)));
    }
    const origin = await getPublishOrigin();
    return origin ? toHttpUrl(`${origin}${AEM_QUERY_PREFIX}${LIST_QUERY};canal=${encodeURIComponent(channel)}`) : null;
  }

  // absolute URL on another host (AEM publish or app proxy): as written
  if (/^https?:\/\//i.test(value)) {
    const url = toHttpUrl(value);
    if (!url) return null;
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/graphql/')) return url;
  }

  // persisted-query path (DA may turn an authored publish link into a site-relative one)
  const origin = await getPublishOrigin();
  if (!origin) return null;
  let path = /^https?:\/\//i.test(value) ? new URL(value).pathname : value.split(/[?#]/)[0];
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.startsWith('/graphql/')) path = `/graphql/execute.json${path}`;
  const url = new URL(origin);
  url.pathname = path;
  return url;
}

async function fetchJson(url, timeout, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url.href, { credentials: 'omit', ...init, signal: controller.signal });
    if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/* ---------------------------------------------------------------------------------------- */
/* Audience                                                                                  */
/* ---------------------------------------------------------------------------------------- */

function matchesAudience(item, audience) {
  const values = (Array.isArray(item.publico) ? item.publico : [item.publico])
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim().toLowerCase());
  return !values.length || values.includes('todos') || values.includes(audience.toLowerCase());
}

/* ---------------------------------------------------------------------------------------- */
/* Items                                                                                     */
/* ---------------------------------------------------------------------------------------- */

function extractItems(json) {
  const data = json?.data;
  let items = [];
  if (Array.isArray(data?.bannerList?.items)) items = data.bannerList.items;
  else if (data?.bannerByPath?.item) items = [data.bannerByPath.item];
  return items.filter((item) => item && typeof item === 'object');
}

function parseDate(value, endOfDay) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}` : v);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActive(item, now) {
  const from = parseDate(item.ativoDe, false);
  const to = parseDate(item.ativoAte, true);
  return (!from || now >= from) && (!to || now <= to);
}

function byOrder(items) {
  const order = (item) => {
    const n = Number(item.ordem);
    return item.ordem !== null && item.ordem !== undefined && item.ordem !== '' && Number.isFinite(n) ? n : Infinity;
  };
  return [...items].sort((a, b) => order(a) - order(b));
}

/** http(s) or site-relative ("/x", not "//x") links only. */
function safeHref(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^\/(?![/\\])/.test(v)) return v;
  return toHttpUrl(v)?.href || null;
}

/**
 * ImageRef (jpg: _publishUrl, _dynamicUrl, width, height) or DocumentRef (webp: _path,
 * _publishUrl). Order: _publishUrl, then publish host + _path, then _dynamicUrl (with width).
 */
function resolveImage(ref, assetOrigin) {
  if (!ref) return null;
  const image = typeof ref === 'string' ? { _path: ref } : ref;
  const publishUrl = toHttpUrl(image._publishUrl, assetOrigin);
  const pathUrl = typeof image._path === 'string' && image._path.startsWith('/') ? toHttpUrl(image._path, assetOrigin) : null;
  const plainUrl = publishUrl || pathUrl;
  // Dynamic Media first (resized/optimized renditions); the plain DAM URL is the fallback
  const dynamicUrl = toHttpUrl(image._dynamicUrl, assetOrigin);
  if (dynamicUrl) return { url: dynamicUrl, dynamic: true, fallback: plainUrl };
  return plainUrl ? { url: plainUrl, dynamic: false } : null;
}

/*
 * Dynamic Media widths per picture (sizes="100vw"): the browser takes the smallest one that
 * covers the viewport at its pixel density. The mobile variant (CSS: below 768px) stays at
 * 750px on 1x-2x phones; the desktop variant tops out at 2000px.
 */
const DM_WIDTHS = {
  desktop: [1080, 1600, 2000],
  mobile: [750, 1080],
  single: [750, 1080, 1600, 2000],
};

function dynamicSrc(url, width) {
  const u = new URL(url.href);
  if (u.pathname.includes('/is/image/')) {
    u.searchParams.set('wid', width);
    u.searchParams.set('fmt', 'webp-alpha');
  } else {
    u.searchParams.set('width', width);
    u.searchParams.set('preferwebp', 'true');
    if (!u.searchParams.has('quality')) u.searchParams.set('quality', '85');
  }
  return u.href;
}

/**
 * @param {{url: URL, dynamic: boolean, fallback?: URL}} image resolved image
 * @param {string} alt alt text
 * @param {'desktop'|'mobile'|'single'} variant which viewports show the picture
 */
function buildPicture({ url, dynamic, fallback }, alt, variant = 'single') {
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  if (dynamic) {
    const widths = DM_WIDTHS[variant] || DM_WIDTHS.single;
    img.srcset = widths.map((w) => `${dynamicSrc(url, w)} ${w}w`).join(', ');
    img.sizes = '100vw';
    img.src = dynamicSrc(url, widths[0]);
  } else {
    img.src = url.href;
  }
  img.alt = alt;
  img.loading = 'lazy';
  // Dynamic Media rendition failed: retry once with the plain DAM URL; still failing
  // (unpublished/missing asset): show the hero background instead of a broken image + alt text
  const onError = () => {
    if (dynamic && fallback && img.dataset.fallback !== 'true') {
      img.dataset.fallback = 'true';
      picture.querySelectorAll('source').forEach((source) => source.remove());
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = fallback.href;
      return;
    }
    img.removeEventListener('error', onError);
    picture.style.display = 'none';
  };
  img.addEventListener('error', onError);
  picture.append(img);
  return picture;
}

const slug = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.plaintext === 'string') return value.plaintext.trim();
  return '';
}

function linkParagraph(label, href) {
  const safe = safeHref(href);
  const caption = text(label);
  if (!safe || !caption) return null;
  const p = document.createElement('p');
  const a = document.createElement('a');
  a.href = safe;
  a.textContent = caption;
  p.append(a);
  return p;
}

/** One `banner` fragment -> authored-equivalent row (or null when nothing renderable). */
function buildRow(item, assetOrigin) {
  const title = text(item.titulo);
  const alt = text(item.imagemAlt);
  const images = [['imagem', item.imagem], ['imagemMobile', item.imagemMobile]]
    .map(([field, ref]) => ({ field, image: resolveImage(ref, assetOrigin) }))
    .filter(({ image }) => image);
  if (!title && !images.length) return null;

  const row = document.createElement('div');
  if (images.length) {
    const imageCell = document.createElement('div');
    // two pictures: desktop + mobile variant (carousel-hero.js), one: shown at every width
    const variants = images.length > 1 ? ['desktop', 'mobile'] : ['single'];
    images.forEach(({ image }, i) => imageCell.append(buildPicture(image, alt, variants[i])));
    row.append(imageCell);
  }

  const content = document.createElement('div');
  if (title) {
    const h2 = document.createElement('h2');
    h2.id = slug(title);
    h2.textContent = title;
    content.append(h2);
  }
  const paragraphs = text(item.resumo).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  paragraphs.forEach((para) => {
    const p = document.createElement('p');
    p.textContent = para;
    content.append(p);
  });
  [
    linkParagraph(item.ctaTexto, item.ctaLink),
    linkParagraph(item.ctaSecundarioTexto, item.ctaSecundarioLink),
  ].filter(Boolean).forEach((p) => content.append(p));
  row.append(content);

  return {
    row,
    path: typeof item._path === 'string' ? item._path : '',
    // for the Universal Editor: the fragment and which CF field each picture shows
    item,
    imageFields: images.map(({ field }) => field),
  };
}

/* ---------------------------------------------------------------------------------------- */
/* Personalization (Adobe Target via Web SDK)                                                */
/* ---------------------------------------------------------------------------------------- */

/** banner-por-path on the same AEM endpoint as the list query, or `aem-banner-by-path-url`. */
async function byPathUrl(sourceUrl, bannerPath) {
  const template = (await getSiteConfig())['aem-banner-by-path-url'];
  if (typeof template === 'string' && template) {
    return toHttpUrl(template.replace(/\{path\}/g, encodeURIComponent(bannerPath)));
  }
  let { origin } = sourceUrl;
  let prefix = AEM_QUERY_PREFIX;
  const match = isPersistedQuery(sourceUrl) && sourceUrl.pathname.match(/^(.*\/execute\.json\/[^/;]+\/)/);
  if (match) [, prefix] = match;
  else origin = await getPublishOrigin();
  if (!origin) return null;
  // AEM does not decode %2F in persisted-query variables: the (validated) path goes in raw
  return toHttpUrl(`${origin}${prefix}${BY_PATH_QUERY};path=${bannerPath}`);
}

const BANNER_PATH = /^\/content\/dam\/[\w\-/.]+$/;

// decision of this page view: refreshes re-apply it instead of asking Target every few seconds
let decision = null;

function readPropositionContent(proposition) {
  let content = proposition?.items?.[0]?.data?.content;
  if (typeof content === 'string') content = JSON.parse(content);
  return content && typeof content === 'object' ? content : null;
}

/**
 * Target JSON offer: { "bannerPath": "/content/dam/…", "ocultar": ["/content/dam/…"] }
 * (both optional): the banner shown first and the banners taken out for this visitor. The
 * default experience (default content, no JSON) changes nothing but is still reported.
 */
function readDecision(propositions, scope) {
  const proposition = propositions.find((p) => p?.scope === scope && p.items?.length)
    || propositions.find((p) => p?.items?.length);
  if (!proposition) return null;
  let content = null;
  try {
    content = readPropositionContent(proposition);
  } catch (e) {
    // not JSON (default content): no change
  }
  const bannerPath = typeof content?.bannerPath === 'string' && BANNER_PATH.test(content.bannerPath)
    ? content.bannerPath : '';
  const hide = (Array.isArray(content?.ocultar) ? content.ocultar : [content?.ocultar])
    .filter((path) => typeof path === 'string' && BANNER_PATH.test(path));
  return { bannerPath, hide, proposition };
}

/**
 * Applies a decision: hidden banners out, the chosen one first. The chosen banner may be one
 * the default audience doesn't see (e.g. publico "cliente-protege-casa"): it is taken from the
 * whole list, else fetched by path.
 */
async function applyDecision(items, all, { bannerPath, hide }, sourceUrl) {
  let ordered = items.filter((item) => !hide.includes(item._path));
  if (!bannerPath) return ordered;
  ordered = ordered.filter((item) => item._path !== bannerPath);
  let chosen = all.find((item) => item._path === bannerPath);
  if (!chosen) {
    const url = await byPathUrl(sourceUrl, bannerPath);
    if (url) {
      [chosen] = extractItems(await fetchJson(url, FETCH_TIMEOUT_MS))
        .filter((item) => isActive(item, new Date()));
    }
  }
  return chosen ? [chosen, ...ordered] : ordered;
}

/**
 * Target decision for a scope, with the visitor's Commerce facts as mbox parameters
 * (scripts/target-profile.js). Rejects when the Web SDK is not configured.
 * @param {string} scope decision scope
 * @returns {Promise<Object[]>} propositions
 */
export async function requestTargetDecision(scope) {
  const [{ requestDecision }, { getTargetParams }] = await Promise.all([
    import('../../scripts/web-sdk.js'),
    import('../../scripts/target-profile.js'),
  ]);
  return requestDecision(scope, await getTargetParams());
}

/**
 * Inert unless the block has an "Escopo Target" and the Web SDK is configured; the decision is
 * requested by carousel-hero.js while the banners load (prefetched.decision), else here.
 */
async function personalize(items, all, {
  scope, sourceUrl, refresh, request,
}) {
  if (!scope) return { items };
  try {
    if (!refresh) {
      const propositions = await withTimeout(
        request || requestTargetDecision(scope),
        ALLOY_TIMEOUT_MS,
      );
      decision = readDecision(propositions, scope);
    }
    if (!decision) return { items };
    return {
      items: await applyDecision(items, all, decision, sourceUrl),
      proposition: decision.proposition,
    };
  } catch (e) {
    return { items };
  }
}

async function notify(proposition, eventType) {
  try {
    const { notifyProposition } = await import('../../scripts/web-sdk.js');
    notifyProposition(proposition, eventType);
  } catch (e) {
    // ignore
  }
}

/**
 * @param {{source?: string, audience?: string, targetScope?: string}} config block config rows
 * @param {{url?: string, json?: Promise<object>, config?: Promise<object|null>,
 *   decision?: Promise<object[]>}|null} [prefetched] requests already started by
 *   carousel-hero.js: the banner list (used when it is for the resolved source URL), the site
 *   config and the Target decision
 * @param {{refresh?: boolean}} [options] refresh: re-check for published changes (no HTTP cache,
 *   no Target decision / impression)
 * @returns {Promise<{rows: {row: HTMLElement, path: string, item: object,
 *   imageFields: string[]}[], audience: string, signature: string, decidedPath: string,
 *   onDisplay: Function, onInteract: Function}|null>}
 *   null when there is nothing to render (caller keeps the authored fallback); signature changes
 *   only when the rendered banners change
 */
export default async function loadBannerRows(config, prefetched = null, options = {}) {
  primeSiteConfig(prefetched?.config);
  // site config (publish origin of the images) in parallel with the banner request, not after it
  const publishOrigin = getPublishOrigin();
  const sourceUrl = await resolveSourceUrl(config.source);
  if (!sourceUrl) return null;

  // no per-person logic here: the authored "Público" row, else the default audience
  const audience = config.audience || DEFAULT_AUDIENCE;
  const json = prefetched?.json && prefetched.url === sourceUrl.href
    ? await prefetched.json
    : await fetchJson(sourceUrl, FETCH_TIMEOUT_MS, options.refresh ? { cache: 'no-store' } : {});

  const now = new Date();
  const all = extractItems(json).filter((item) => isActive(item, now));
  const items = byOrder(all.filter((item) => matchesAudience(item, audience)));
  if (!items.length) return null;

  // a banner chosen by Target is shown whatever its publico (Target owns the per-person choice);
  // refreshes re-apply the first decision instead of asking Target again every few seconds
  const { items: ordered, proposition } = await personalize(items, all, {
    scope: config.targetScope,
    sourceUrl,
    refresh: options.refresh,
    request: prefetched?.decision,
  });
  const assetOrigin = (await publishOrigin) || sourceUrl.origin;
  const rows = ordered.map((item) => buildRow(item, assetOrigin)).filter(Boolean);
  if (!rows.length) return null;
  const decidedPath = proposition && decision?.bannerPath ? decision.bannerPath : '';
  return {
    rows,
    audience,
    signature: JSON.stringify(ordered),
    decidedPath,
    onDisplay: proposition && !options.refresh
      ? () => notify(proposition, 'decisioning.propositionDisplay') : () => {},
    onInteract: proposition ? () => notify(proposition, 'decisioning.propositionInteract') : () => {},
  };
}
