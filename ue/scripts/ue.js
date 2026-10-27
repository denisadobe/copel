/*
 * Universal Editor (Author Bus) behaviors. Loaded by scripts/scripts.js only in the editor
 * (*.ue.da.live, see IS_UE in scripts/ue-utils.js), before the page decorates.
 * Blocks keep their own instrumentation (moveInstrumentation in scripts/ue-utils.js); this file
 * makes interactive blocks react to what the author selects in the editor. After an edit of
 * DA content (urn:ab:…) the editor reloads the page, so every block decorates once from fresh
 * content.
 *
 * Second connection (AEM author): the banner Content Fragments rendered by carousel-hero are
 * instrumented as urn:aemconnection:<fragment>/jcr:content/data/master. This file adds the
 * connection meta (urn:adobe:aue:system:aemconnection, config.json "aem-author-url") next to
 * the Author Bus one (urn:adobe:aue:system:ab) and updates those slides in place on content
 * events, because the published banner source does not show unpublished author changes (a
 * reload would bring the old values back).
 *
 * Blocks are reached through DOM events (no block module imports):
 *   carousel-hero        listens to "carousel-hero:show" { detail: { index } }
 *   accordion-faq        <details> items are opened directly
 *   carousel-coverage / carousel-quicklinks   the selected item is scrolled into view
 */

const AEM_CONNECTION = 'aemconnection';
const AEM_PREFIX = `urn:${AEM_CONNECTION}:`;
// same cache key/shape as scripts/commerce.js and carousel-hero-cf.js
const CONFIG_CACHE_KEY = 'commerce-config';

let siteConfig = {};

async function loadSiteConfig() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CONFIG_CACHE_KEY));
    if (cached && cached[':expiry'] > Date.now() / 1000 && cached.public?.default) return cached.public.default;
  } catch (e) {
    // ignore malformed cache
  }
  try {
    const resp = await fetch(`${window.location.origin}/config.json`);
    return resp.ok ? (await resp.json())?.public?.default || {} : {};
  } catch (e) {
    return {};
  }
}

const toOrigin = (value) => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : null;
  } catch (e) {
    return null;
  }
};

/** config.json "aem-author-url", else derived from "aem-publish-url" (publish- -> author-). */
function authorOrigin() {
  const author = toOrigin(siteConfig['aem-author-url']);
  if (author) return author;
  const publish = toOrigin(siteConfig['aem-publish-url']);
  return publish && publish.includes('//publish-') ? publish.replace('//publish-', '//author-') : null;
}

/** Adds the AEM author connection next to the Author Bus one (both are read by the editor). */
function addAemConnection() {
  const origin = authorOrigin();
  if (!origin || document.querySelector(`meta[name="urn:adobe:aue:system:${AEM_CONNECTION}"]`)) return;
  const meta = document.createElement('meta');
  meta.name = `urn:adobe:aue:system:${AEM_CONNECTION}`;
  meta.content = `aem:${origin}`;
  const ab = document.querySelector('meta[name^="urn:adobe:aue:system:"]');
  if (ab) ab.after(meta);
  else document.head.prepend(meta);
}

/* ---------------------------------------------------------------------------------------- */
/* Live updates of Content Fragment slides (AEM connection)                                  */
/* ---------------------------------------------------------------------------------------- */

const valueText = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value?.plaintext === 'string') return value.plaintext;
  if (typeof value?.value === 'string') return value.value;
  return null;
};

/** http(s) or site-relative links only (as carousel-hero-cf.js). */
function safeHref(value) {
  const v = (value || '').trim();
  if (/^\/(?![/\\])/.test(v)) return v;
  return toOrigin(v) ? new URL(v).href : null;
}

/** New image of a CF image field: a URL, or a DAM path shown from the publish tier. */
function setImage(img, value) {
  let src = null;
  if (/^https?:\/\//i.test(value)) src = value;
  else if (value.startsWith('/content/dam/')) {
    const publish = toOrigin(siteConfig['aem-publish-url']);
    if (publish) src = `${publish}${value}`;
  }
  if (!src) return false;
  const picture = img.closest('picture');
  const previous = img.currentSrc || img.src;
  picture?.querySelectorAll('source').forEach((source) => source.remove());
  img.removeAttribute('srcset');
  img.dataset.fallback = 'true'; // no Dynamic Media retry (carousel-hero-cf.js)
  // not published yet: keep the previous image rather than an empty slide
  img.addEventListener('error', () => {
    if (picture) picture.style.display = '';
    img.src = previous;
  }, { once: true });
  if (picture) picture.style.display = '';
  img.src = src;
  return true;
}

/**
 * Applies a new value of a CF field to every element of the fragment's slide(s).
 * @returns {boolean} whether something on the page shows that field
 */
function applyCfValue(resource, prop, rawValue, { images = true } = {}) {
  const value = valueText(rawValue);
  if (!prop || value === null) return false;
  let applied = false;
  document.querySelectorAll(`[data-aue-resource="${resource}"]`).forEach((root) => {
    root.querySelectorAll(`[data-aue-prop="${prop}"]`).forEach((el) => {
      if (el.dataset.aueType === 'media') {
        if (images && el.tagName === 'IMG') applied = setImage(el, value.trim()) || applied;
      } else {
        el.textContent = value.trim();
        applied = true;
      }
    });
    root.querySelectorAll(`[data-cf-link-prop="${prop}"]`).forEach((a) => {
      const href = safeHref(value);
      if (href) a.href = href;
      applied = true;
    });
    root.querySelectorAll(`[data-cf-alt-prop="${prop}"]`).forEach((img) => {
      img.alt = value.trim();
      applied = true;
    });
    if (prop === 'titulo' && value.trim()) {
      root.dataset.aueLabel = `Banner: ${value.trim()}`;
      if (root.matches('.carousel-hero-slide')) root.setAttribute('aria-label', value.trim());
    }
  });
  return applied;
}

const aemResource = (detail) => {
  const resource = detail?.request?.target?.resource || detail?.resource;
  return typeof resource === 'string' && resource.startsWith(AEM_PREFIX) ? resource : null;
};

function setupAemConnectionHandlers() {
  // properties panel edit: { patch: { name, value } }. The default (page reload) would show the
  // published value again, so the slide is updated in place instead.
  document.body.addEventListener('aue:content-patch', (event) => {
    const resource = aemResource(event.detail);
    if (!resource) return;
    const { name, value } = event.detail.patch || {};
    applyCfValue(resource, name, value);
    event.preventDefault();
  });

  // in-context (inline) edit: { value }, the prop is in request.target.prop
  document.body.addEventListener('aue:content-update', (event) => {
    const resource = aemResource(event.detail);
    if (!resource) return;
    const prop = event.detail.request?.target?.prop;
    if (applyCfValue(resource, prop, event.detail.value)) event.preventDefault();
  });

  // fragment loaded in the properties panel: its author values (possibly unpublished) replace
  // the published texts on the slide; images are left as rendered
  document.body.addEventListener('aue:content-details', (event) => {
    const resource = aemResource(event.detail);
    const content = event.detail?.content;
    if (!resource || !content || typeof content !== 'object') return;
    Object.entries(content).forEach(([prop, value]) => {
      applyCfValue(resource, prop, value, { images: false });
    });
  });
}

const setupUEEventHandlers = () => {
  // when an image is swapped in the editor, drop stale responsive sources
  // (Content Fragment images of the AEM connection: see setupAemConnectionHandlers)
  document.body.addEventListener('aue:content-patch', ({ detail: { patch, request } }) => {
    if (request?.target?.resource?.startsWith(AEM_PREFIX)) return;
    let element = document.querySelector(`[data-aue-resource="${request.target.resource}"]`);
    if (element && element.getAttribute('data-aue-prop') !== patch.name) element = element.querySelector(`[data-aue-prop='${patch.name}']`);
    if (element?.getAttribute('data-aue-type') !== 'media') return;

    const picture = element.tagName === 'IMG' ? element.closest('picture') : element;
    picture?.querySelectorAll('source').forEach((source) => source.remove());
    picture?.querySelector('img')?.removeAttribute('srcset');
  });

  // bring the selected item into view inside carousels and accordions
  document.body.addEventListener('aue:ui-select', ({ detail }) => {
    const resource = detail?.resource;
    if (!resource) return;
    const element = document.querySelector(`[data-aue-resource="${resource}"]`);
    if (!element) return;
    const blockEl = element.closest('.block');
    if (!blockEl) return;

    if (blockEl.classList.contains('carousel-hero')) {
      const slide = element.closest('.carousel-hero-slide');
      // hidden authored fallback (Content Fragments shown instead): nothing to bring into view
      if (slide && !slide.closest('.carousel-hero-fallback')) {
        blockEl.dispatchEvent(new CustomEvent('carousel-hero:show', {
          detail: { index: parseInt(slide.dataset.slideIndex, 10) },
        }));
      }
    } else if (blockEl.classList.contains('accordion-faq')) {
      element.closest('details')?.setAttribute('open', '');
    } else if (blockEl.classList.contains('carousel-coverage') || blockEl.classList.contains('carousel-quicklinks')) {
      element.closest('li')?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
    }
  });
};

export default async () => {
  // handlers first (no await), then the AEM connection once config.json is read
  setupUEEventHandlers();
  setupAemConnectionHandlers();
  siteConfig = await loadSiteConfig();
  addAemConnection();
};
