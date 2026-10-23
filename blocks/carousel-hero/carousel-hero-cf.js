/* eslint-disable no-underscore-dangle -- AEM GraphQL fields (_path, _publishUrl, _dynamicUrl) */
/*
 * carousel-hero: AEM headless source (banner Content Fragments via GraphQL persisted query).
 * Loaded on demand by carousel-hero.js only when the block has a "Fonte"/"Source" config row.
 *
 * Turns each `banner` Content Fragment into a row with exactly the authored structure
 * (cell 1: picture(s), cell 2: h2 + p + p>a), so carousel-hero.js decorates it unchanged.
 * DOM is built with createElement/textContent only (CSP: require-trusted-types-for 'script').
 */

const FETCH_TIMEOUT_MS = 4000;
const ALLOY_TIMEOUT_MS = 1500;
const DEFAULT_QUERY_PREFIX = '/graphql/execute.json/copel/';
const BY_PATH_QUERY = 'banner-por-path';
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

async function getPublishOrigin() {
  const value = (await getSiteConfig())['aem-publish-url'];
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return isHttp(url) ? url.origin : null;
  } catch (e) {
    return null;
  }
}

/**
 * Absolute persisted-query URL. Accepts a full URL, a publish-relative path
 * (/graphql/execute.json/copel/…) or just "copel/banners-por-canal;canal=site".
 */
async function resolveQueryUrl(value) {
  if (!value) return null;
  const isAbsolute = /^https?:\/\//i.test(value);
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch (e) {
    return null;
  }
  if (!isAbsolute || url.origin === window.location.origin) {
    const origin = await getPublishOrigin();
    if (!origin) return null;
    let path = isAbsolute ? url.pathname : value.split(/[?#]/)[0];
    if (!path.startsWith('/')) path = `/${path}`;
    if (!path.startsWith('/graphql/')) path = `/graphql/execute.json${path}`;
    url = new URL(origin);
    url.pathname = path;
  }
  return isHttp(url) ? url : null;
}

/** Adds a persisted-query variable (";name=value") unless the URL already sets it. */
function addVariable(url, name, value) {
  if (!value || new RegExp(`;${name}=`).test(url.pathname)) return;
  url.pathname = `${url.pathname};${name}=${encodeURIComponent(value)}`;
}

async function fetchJson(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url.href, { credentials: 'omit', signal: controller.signal });
    if (!resp.ok) throw new Error(`Persisted query failed (${resp.status})`);
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
  try {
    const url = new URL(v);
    return isHttp(url) ? url.href : null;
  } catch (e) {
    return null;
  }
}

function resolveImage(ref, origin) {
  if (!ref) return null;
  const image = typeof ref === 'string' ? { _path: ref } : ref;
  const value = image._dynamicUrl || image._publishUrl || image._path;
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, origin);
    if (!isHttp(url)) return null;
    const dynamic = !!image._dynamicUrl
      || url.pathname.includes('/adobe/dynamicmedia/deliver/')
      || url.pathname.includes('/is/image/');
    return { url, dynamic };
  } catch (e) {
    return null;
  }
}

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

function buildPicture({ url, dynamic }, alt) {
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  if (dynamic) {
    const source = document.createElement('source');
    source.media = '(min-width: 600px)';
    source.srcset = dynamicSrc(url, 2000);
    picture.append(source);
    img.src = dynamicSrc(url, 750);
  } else {
    img.src = url.href;
  }
  img.alt = alt;
  img.loading = 'lazy';
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
function buildRow(item, origin) {
  const title = text(item.titulo);
  const alt = text(item.imagemAlt) || '';
  const images = [resolveImage(item.imagem, origin), resolveImage(item.imagemMobile, origin)]
    .filter(Boolean);
  if (!title && !images.length) return null;

  const row = document.createElement('div');
  if (images.length) {
    const imageCell = document.createElement('div');
    images.forEach((image) => imageCell.append(buildPicture(image, alt)));
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

  return { row, path: typeof item._path === 'string' ? item._path : '' };
}

function byPathUrl(queryUrl, bannerPath) {
  const url = new URL(queryUrl.origin);
  const prefix = queryUrl.pathname.match(/^(.*\/execute\.json\/[^/;]+\/)/)?.[1] || DEFAULT_QUERY_PREFIX;
  url.pathname = `${prefix}${BY_PATH_QUERY};path=${encodeURIComponent(bannerPath)}`;
  return url;
}

function readPropositionContent(proposition) {
  let content = proposition?.items?.[0]?.data?.content;
  if (typeof content === 'string') content = JSON.parse(content);
  return content && typeof content === 'object' ? content : null;
}

/**
 * Adobe Target hook (inert unless a scope is configured and Web SDK is on the page):
 * moves the decided banner first, fetching it by path when it is not in the list.
 */
async function personalize(items, scope, queryUrl, now) {
  if (!scope || typeof window.alloy !== 'function') return { items };
  try {
    const result = await withTimeout(
      window.alloy('sendEvent', { decisionScopes: [scope], renderDecisions: false }),
      ALLOY_TIMEOUT_MS,
    );
    const propositions = Array.isArray(result?.propositions) ? result.propositions : [];
    const proposition = propositions.find((p) => p?.scope === scope && p.items?.length)
      || propositions.find((p) => p?.items?.length);
    const bannerPath = readPropositionContent(proposition)?.bannerPath;
    if (typeof bannerPath !== 'string' || !bannerPath.startsWith('/content/dam/')) return { items };

    const index = items.findIndex((item) => item._path === bannerPath);
    if (index >= 0) {
      return { items: [items[index], ...items.filter((_, i) => i !== index)], proposition };
    }
    const [extra] = extractItems(await fetchJson(byPathUrl(queryUrl, bannerPath), FETCH_TIMEOUT_MS))
      .filter((item) => isActive(item, now));
    if (!extra) return { items };
    return { items: [extra, ...items], proposition };
  } catch (e) {
    return { items };
  }
}

function recordDisplay(proposition) {
  try {
    const { id, scope, scopeDetails } = proposition;
    Promise.resolve(window.alloy('sendEvent', {
      xdm: {
        eventType: 'decisioning.propositionDisplay',
        _experience: { decisioning: { propositions: [{ id, scope, scopeDetails }] } },
      },
    })).catch(() => {});
  } catch (e) {
    // ignore
  }
}

/**
 * @param {{source?: string, audience?: string, targetScope?: string}} config block config rows
 * @returns {Promise<{rows: {row: HTMLElement, path: string}[], onDisplay: Function}|null>}
 *   null when there is nothing to render (caller keeps the authored fallback)
 */
export default async function loadBannerRows(config) {
  const queryUrl = await resolveQueryUrl(config.source);
  if (!queryUrl) return null;
  addVariable(queryUrl, 'publico', config.audience);

  const now = new Date();
  const json = await fetchJson(queryUrl, FETCH_TIMEOUT_MS);
  const items = byOrder(extractItems(json).filter((item) => isActive(item, now)));
  if (!items.length) return null;

  const { items: ordered, proposition } = await personalize(
    items,
    config.targetScope,
    queryUrl,
    now,
  );
  const rows = ordered.map((item) => buildRow(item, queryUrl.origin)).filter(Boolean);
  if (!rows.length) return null;
  return { rows, onDisplay: proposition ? () => recordDisplay(proposition) : () => {} };
}
