/* eslint-disable */
/* global WebImporter */

/**
 * Copel (Elementor / WordPress) cleanup transformer.
 * Removes non-authorable site chrome and third-party widgets while keeping
 * authorable content (including content iframes such as copel.com/slwweb embeds).
 */

// Removed before parsers run (affects block matching).
const PRE_SELECTORS = [
  // Global header (Elementor theme location) + skip-link nav
  'header.elementor-location-header',
  '.elementor-location-header',
  // .elementor-element-30be8ff is handled by normalizeAnchorMenus(): removed only when it is
  // (part of) the global header; on landing pages (servico) it is the in-page anchor menu.
  'body > nav',
  '.ea11y-skip-to-content-backdrop',
  // Global footer + footer link columns rendered inside page content
  'footer.elementor-location-footer',
  'footer.elementor-39110',
  '.elementor-39110',
  '.elementor-location-footer',
  // Hidden 1px WhatsApp contact spacer (home)
  '.elementor-element-3a08acf4',
  // Mobile-only copy of the "Para sua casa / Para sua empresa" tiles (home); the desktop
  // tiles become the cards-audience block, which is responsive.
  '.elementor-element-563a500.elementor-hidden-desktop',
  // Empty full-width spacer section before the footer (atendimento / falta-de-luz)
  '.elementor-element-693041be',
  // Elementor header/footer menu toggles (icon-only chrome)
  '.elementor-menu-toggle',
  // Archive pagination (noticias) - the migrated list is static
  'nav.elementor-pagination',
  // WordPress "Categorias" sidebar widget (noticias) - not part of the migrated sidebar
  '.elementor-widget-wp-widget-categories',
  // Spacer widgets (servico plan cards) carry no content
  '.elementor-widget-spacer',
  // Container hidden on every breakpoint (servico "Agora que voce ja sabe tudo..." band).
  // Scoped by id: home keeps its all-hidden containers (regression-locked output).
  '.elementor-element-8ba4d6d.elementor-hidden-desktop.elementor-hidden-tablet.elementor-hidden-mobile',
  // Floating "Fale com um consultor" WhatsApp / e-mail buttons (servico) + Elementor popups
  // (e.g. WPForms "Contato" popup 44346) - popups are excluded from the page body
  '.elementor-element-6d8fb32',
  '.elementor-location-popup',
  '[data-elementor-type="popup"]',
  '.wpforms-container',
  // Cookie consent (Privacy Tools)
  '#byRemovePortal',
  '#dp_content_obj2',
  '#dp_content_preference',
  '#privacytools-banner-consent',
  '.cc-window',
  // Webchat launcher
  '#webchat',
  // Accessibility widgets (VLibras, ally)
  '#vlibras-access-wrapper',
  '[vw]',
  '.vw-plugin-top-wrapper',
  'body > div.enabled',
  '[class*="ea11y-"]',
  // reCAPTCHA badge
  '.grecaptcha-badge',
  'iframe[src*="recaptcha"]',
  'textarea.g-recaptcha-response',
  // Tracking / technical
  'iframe[src*="googletagmanager.com"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="facebook.com/tr"]',
  '#elementor-device-mode',
  'body > img[src^="data:image/svg+xml"]',
  'script',
  'style',
  'noscript',
  'link',
];

// Final cleanup after parsers run.
const POST_SELECTORS = [
  'script',
  'style',
  'noscript',
  'link',
  'meta',
  'iframe:not([src])',
  'iframe[src=""]',
];

const TRACKING_ATTRS = [
  'data-elementor-type',
  'data-elementor-id',
  'data-elementor-post-type',
  'data-elementor-device-mode',
  'data-id',
  'data-element_type',
  'data-widget_type',
  'data-settings',
  'data-model-cid',
  'data-e-type',
  'data-gtm',
  'data-ga',
  'data-track',
  'onclick',
  'onload',
  'data-bg-src',
  'data-excluded',
];

function removeAll(root, selectors) {
  selectors.forEach((sel) => {
    try {
      root.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (e) {
      // ignore invalid selector in this DOM implementation
    }
  });
}

function removeEmptyWrappers(root) {
  // Body-level wrappers left empty after widget removal (e.g. reCAPTCHA host div).
  const body = root.querySelector('body') || root;
  [...body.children].forEach((el) => {
    if (el.tagName !== 'DIV') return;
    if (el.textContent.trim()) return;
    if (el.querySelector('img, picture, video, iframe, a, table, hr, svg')) return;
    el.remove();
  });
}

const HAS_MEDIA = 'img, picture, video, iframe, svg, table, [data-bg-src]';

/**
 * Footer-like link columns rendered inside page content: a top-level section whose 3+
 * columns each hold heading + divider + icon-list widgets. Sections the template maps
 * (e.g. home .elementor-element-a75d5f3 -> columns-links block) are kept.
 */
function removeFooterLinkColumns(root, template) {
  const mapped = ((template && template.sections) || [])
    .flatMap((s) => (Array.isArray(s.selector) ? s.selector : [s.selector]));
  const isMapped = (sec) => mapped.some((sel) => {
    try { return sel && sec.matches(sel); } catch (e) { return false; }
  });
  root.querySelectorAll('.elementor-top-section').forEach((sec) => {
    if (isMapped(sec)) return;
    const cols = [...sec.querySelectorAll(':scope > .elementor-container > .elementor-column')];
    if (cols.length < 3) return;
    const footerLike = cols.every((col) => col.querySelector('.elementor-widget-heading')
      && col.querySelector('.elementor-widget-divider')
      && col.querySelector('.elementor-widget-icon-list'));
    if (footerLike) sec.remove();
  });
}

/** Empty top-level spacer sections (no text, no media, no background image). */
function removeEmptySections(root, template) {
  const keep = new Set();
  ((template && template.sections) || []).forEach((s) => {
    (Array.isArray(s.selector) ? s.selector : [s.selector]).forEach((sel) => {
      try { root.querySelectorAll(sel).forEach((el) => keep.add(el)); } catch (e) { /* ignore */ }
    });
  });
  root.querySelectorAll('.elementor-top-section, .elementor-section, .e-con.e-parent').forEach((sec) => {
    if (keep.has(sec) || !sec.parentNode) return;
    if (sec.textContent.trim()) return;
    if (sec.matches('[data-bg-src]') || sec.querySelector(HAS_MEDIA)) return;
    sec.remove();
  });
}

/**
 * Within each top-level section, text-editor widgets that open with a heading are
 * sibling instruction groups: normalize their lead heading level to the first one
 * (e.g. "No app Copel:" H3 / "Por SMS:" H6 -> both H3).
 */
function normalizeSiblingHeadings(root) {
  const doc = root.ownerDocument || root;
  root.querySelectorAll('.elementor-top-section').forEach((sec) => {
    if (sec.parentElement && sec.parentElement.closest('.elementor-top-section')) return;
    const leads = [...sec.querySelectorAll('.elementor-widget-text-editor > .elementor-widget-container')]
      .map((c) => c.firstElementChild)
      .filter((h) => h && /^H[1-6]$/.test(h.tagName));
    if (leads.length < 2) return;
    const tag = leads[0].tagName;
    leads.slice(1).forEach((h) => {
      if (h.tagName === tag) return;
      const n = doc.createElement(tag);
      while (h.firstChild) n.appendChild(h.firstChild);
      h.replaceWith(n);
    });
  });
}

/**
 * Font Awesome icon-only widgets (no image): replace with an EDS icon token
 * (e.g. <i class="far fa-envelope"> -> ":envelope:"). Other icon fonts are dropped
 * in afterTransform.
 */
function tokenizeIconWidgets(root) {
  const doc = root.ownerDocument || root;
  root.querySelectorAll('.elementor-widget-icon').forEach((w) => {
    if (w.querySelector('img, svg')) return;
    const i = w.querySelector('i[class*="fa-"]');
    if (!i) return;
    const m = [...i.classList].map((c) => c.match(/^fa-([a-z0-9-]+)$/)).find(Boolean);
    if (!m) return;
    const p = doc.createElement('p');
    p.textContent = `:${m[1]}:`;
    const link = i.closest('a[href]');
    if (link) {
      const a = doc.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = p.textContent;
      p.textContent = '';
      p.append(a);
    }
    const container = w.querySelector('.elementor-widget-container') || w;
    container.replaceChildren(p);
  });
}

/**
 * If the page has no H1, promote the leading page-title heading (e.g. "Sem Luz" H2).
 * Only applies when that heading precedes every block, so pages opening with a
 * block (e.g. home hero carousel) are left untouched.
 */
function promoteFirstHeading(root) {
  if (root.querySelector('h1')) return;
  const doc = root.ownerDocument || root;
  const first = [...root.querySelectorAll('h2, h3, h4, h5, h6, table')]
    .find((el) => el.tagName === 'TABLE' || el.textContent.trim());
  if (!first || first.tagName === 'TABLE') return;
  const h1 = doc.createElement('h1');
  while (first.firstChild) h1.appendChild(first.firstChild);
  first.replaceWith(h1);
}

/**
 * Elementor sets container / slide backgrounds from post CSS (<link> stylesheets).
 * Those stylesheets are removed below, so record each CSS background image on the
 * matching element as data-bg-src first; parsers read it to build <img> elements.
 */
function materializeBackgrounds(root) {
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  if (!doc.styleSheets) return;
  const applyRule = (rule) => {
    if (rule.cssRules && !rule.selectorText) {
      if (rule.media && view && view.matchMedia && rule.media.mediaText
        && !view.matchMedia(rule.media.mediaText).matches) return;
      [...rule.cssRules].forEach(applyRule);
      return;
    }
    if (!rule.selectorText || !rule.style) return;
    const bi = rule.style.backgroundImage || '';
    const m = bi.match(/url\((['"]?)(.*?)\1\)/i);
    if (!m || !m[2] || m[2].startsWith('data:')) return;
    try {
      root.querySelectorAll(rule.selectorText).forEach((el) => el.setAttribute('data-bg-src', m[2]));
    } catch (e) {
      // selector not supported in this DOM implementation
    }
  };
  [...doc.styleSheets].forEach((sheet) => {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (e) {
      return; // cross-origin stylesheet
    }
    if (rules) [...rules].forEach(applyRule);
  });
}

/**
 * Turn a container's CSS background into an authorable <img> placed right before
 * `target` (a heading). Uses the container's data-bg-src (live page, captured by
 * materializeBackgrounds) or, when the snapshot already rendered the background as
 * a direct-child <img> of the container / its column wrapper, moves that image.
 */
function emitBackgroundBefore(container, target) {
  if (!container || !target || !target.parentNode) return;
  const doc = container.ownerDocument;
  // Background holders: the container, its columns and their widget wraps.
  const holders = [container, ...container.querySelectorAll(
    ':scope > .elementor-container > .elementor-column, :scope > .elementor-container > .elementor-column > .elementor-widget-wrap',
  )];
  let media = holders
    .map((el) => el.querySelector(':scope > img, :scope > picture'))
    .find(Boolean);
  if (!media) {
    const holder = holders.find((el) => el.hasAttribute('data-bg-src'))
      || container.querySelector(':scope > .elementor-background-overlay[data-bg-src]');
    const src = holder && holder.getAttribute('data-bg-src');
    if (!src) return;
    media = doc.createElement('img');
    media.setAttribute('src', src);
    media.setAttribute('alt', '');
  }
  target.parentNode.insertBefore(media, target);
  // The background now lives in the content; stop later background rules from emitting it again.
  holders.forEach((el) => {
    el.removeAttribute('data-bg-src');
    el.style.setProperty('background-image', 'none', 'important');
  });
}

function sectionElements(root, section) {
  const sels = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (let i = 0; i < sels.length; i += 1) {
    try {
      const el = sels[i] && root.querySelector(sels[i]);
      if (el) return el;
    } catch (e) { /* ignore */ }
  }
  return null;
}

/** page-banner sections: background photo becomes an image before the section H1. */
function emitPageBannerImages(root, template) {
  ((template && template.sections) || [])
    .filter((s) => s.style === 'page-banner')
    .forEach((s) => {
      const sec = sectionElements(root, s);
      if (!sec) return;
      const heading = sec.querySelector('h1') || sec.querySelector('h2, h3');
      emitBackgroundBefore(sec, heading);
    });
}

/** Sidebar promo tile (noticias "Webseries"): background image before its H2 link. */
function emitSidebarTileImages(root) {
  root.querySelectorAll('.boxAppBlog').forEach((tile) => {
    emitBackgroundBefore(tile, tile.querySelector('h2'));
  });
}

/**
 * .elementor-element-30be8ff: inside the global header it is header chrome (removed);
 * on landing pages without the global header (servico) it is the in-page anchor menu,
 * rendered twice (sticky + sticky spacer duplicate). Keep ONE copy as a plain list of
 * links (hrefs such as #coberturas / #planos / #faq untouched), dropping the logo
 * images, the mobile dropdown duplicate and the burger toggle.
 */
function normalizeAnchorMenus(root) {
  const doc = root.ownerDocument || root;
  const menus = [...root.querySelectorAll('.elementor-element-30be8ff')];
  const inPage = menus.filter((m) => {
    if (m.closest('header, .elementor-location-header')) {
      m.remove();
      return false;
    }
    return true;
  });
  if (!inPage.length) return;
  const keep = inPage.find((m) => !m.classList.contains('elementor-sticky__spacer')) || inPage[0];
  inPage.forEach((m) => { if (m !== keep) m.remove(); });

  const list = keep.querySelector('nav.elementor-nav-menu--main ul.elementor-nav-menu')
    || keep.querySelector('ul.elementor-nav-menu')
    || keep.querySelector('ul');
  const links = list ? [...list.querySelectorAll(':scope > li > a[href]')] : [];
  if (!links.length) {
    keep.remove();
    return;
  }
  const ul = doc.createElement('ul');
  links.forEach((src) => {
    const text = src.textContent.trim().replace(/\s+/g, ' ');
    if (!text) return;
    const li = doc.createElement('li');
    const a = doc.createElement('a');
    a.setAttribute('href', src.getAttribute('href'));
    a.textContent = text;
    li.append(a);
    ul.append(li);
  });
  keep.replaceWith(ul);
}

/**
 * Mobile-only duplicates (.elementor-hidden-desktop) that have a desktop-only sibling
 * equivalent (.elementor-hidden-mobile), e.g. servico hero images .elementor-element-9086472
 * vs .elementor-element-485b87a. Runs in afterTransform so parsers (hero-service on
 * .elementor-element-b72699d) see the untouched subtree first.
 * Limited to image-only flexbox containers (.e-con, no text): legacy sections and text
 * duplicates (e.g. home mobile hero carousel / mobile news list) are owned by their parsers.
 */
function removeMobileDuplicates(root) {
  const imageOnly = (el) => !el.textContent.trim() && !!el.querySelector('img, picture');
  root.querySelectorAll('.e-con.elementor-hidden-desktop').forEach((el) => {
    if (!el.parentElement || el.classList.contains('elementor-hidden-mobile')) return;
    if (!imageOnly(el)) return;
    const desktopTwin = [...el.parentElement.children].some((sib) => sib !== el
      && sib.classList.contains('e-con')
      && imageOnly(sib)
      && sib.classList.contains('elementor-hidden-mobile')
      && !sib.classList.contains('elementor-hidden-desktop'));
    if (desktopTwin) el.remove();
  });
}

/** Icon-box icons without an image (icon fonts, e.g. fa-edit) carry no content: drop them. */
function dropIconBoxFontIcons(root) {
  root.querySelectorAll('.elementor-widget-icon-box .elementor-icon-box-icon').forEach((box) => {
    if (box.querySelector('img, svg, picture') || box.textContent.trim()) return;
    box.remove();
  });
}

/**
 * Icon-list items marked with a "times" icon (e.g. plan coverages not included) lose that
 * icon when empty icon elements are cleaned up, so record the meaning on the item first.
 */
function markExcludedListItems(root) {
  const view = (root.ownerDocument || root).defaultView;
  // The importer drops empty icon elements early, so also detect the greyed-out text
  // (rgb(224, 224, 224) on the source) that marks a coverage as not included.
  const isGreyedOut = (el) => {
    if (!el || !view || !view.getComputedStyle) return false;
    const m = view.getComputedStyle(el).color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = m.slice(1).map(Number);
    return r === g && g === b && r >= 200 && r < 245;
  };
  root.querySelectorAll('.elementor-icon-list-item').forEach((li) => {
    if (li.querySelector('.fa-times-circle, .fa-times, [class*="e-fas-times"]')
      || isGreyedOut(li.querySelector('.elementor-icon-list-text'))) {
      li.setAttribute('data-excluded', 'true');
    }
  });
}

/**
 * A default-content list holding a single link (Elementor icon-list used as a button, e.g.
 * "Mais Serviços") becomes a plain paragraph link, so it renders as a call to action.
 */
function unwrapSingleLinkLists(root) {
  root.querySelectorAll('ul, ol').forEach((list) => {
    if (list.closest('table')) return;
    const items = list.querySelectorAll(':scope > li');
    if (items.length !== 1) return;
    const links = items[0].querySelectorAll('a[href]');
    if (links.length !== 1 || links[0].textContent.trim() !== items[0].textContent.trim()) return;
    const p = list.ownerDocument.createElement('p');
    p.append(links[0]);
    list.replaceWith(p);
  });
}

export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    markExcludedListItems(element);
    materializeBackgrounds(element);
    removeAll(element, PRE_SELECTORS);
    normalizeAnchorMenus(element);
    emitPageBannerImages(element, payload && payload.template);
    emitSidebarTileImages(element);
    dropIconBoxFontIcons(element);
    removeFooterLinkColumns(element, payload && payload.template);
    tokenizeIconWidgets(element);
    removeEmptySections(element, payload && payload.template);
    normalizeSiblingHeadings(element);
    removeEmptyWrappers(element);
  }

  if (hookName === 'afterTransform') {
    removeAll(element, POST_SELECTORS);
    removeMobileDuplicates(element);
    // Leftover icon fonts carry no authorable content.
    element.querySelectorAll('i[class*="fa-"], i[class*="eicon-"]').forEach((i) => {
      if (!i.textContent.trim()) i.remove();
    });
    promoteFirstHeading(element);
    unwrapSingleLinkLists(element);
    element.querySelectorAll('*').forEach((el) => {
      TRACKING_ATTRS.forEach((attr) => {
        if (el.hasAttribute(attr)) el.removeAttribute(attr);
      });
    });
  }
}
