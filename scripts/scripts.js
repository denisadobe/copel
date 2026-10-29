import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
  readBlockConfig,
  toClassName,
  toCamelCase,
} from './aem.js';
import { IS_UE } from './ue-utils.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

// Adobe Target (at.js, VEC activity on #promo-strip): it sets innerHTML when it starts, so it is
// loaded right after the default policy above; targetGlobalSettings is in head.html
if (!IS_UE) {
  const atjs = document.createElement('script');
  atjs.src = '/scripts/at.js';
  atjs.async = true;
  document.head.append(atjs);
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) {
      // a link alone in a default-content paragraph is a call to action
      if (p.parentElement && p.parentElement.classList.contains('default-content-wrapper')) {
        p.className = 'button-wrapper';
        a.className = 'button primary';
      }
      return;
    }

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Applies Section Metadata tables to their sections and removes them.
 * `style` values (comma separated) become section classes; other keys become data attributes.
 * @param {Element} main The main element
 */
function decorateSectionMetadata(main) {
  main.querySelectorAll(':scope > .section div.section-metadata').forEach((meta) => {
    const section = meta.closest('.section');
    const config = readBlockConfig(meta);
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'style') {
        `${value}`.split(',').map((s) => toClassName(s.trim())).filter(Boolean)
          .forEach((cls) => section.classList.add(cls));
      } else {
        section.dataset[toCamelCase(key)] = value;
      }
    });
    const wrapper = meta.parentElement;
    meta.remove();
    if (wrapper !== section && !wrapper.children.length) wrapper.remove();
  });
}

/**
 * Decorates all sections in a container element. Local replacement for the aem.js version that
 * also understands the Universal Editor markup: on *.ue.da.live, default content arrives wrapped
 * in instrumented `div.richtext` elements (one editable "Text" each). Such a wrapper becomes the
 * default-content wrapper itself, so it stays editable and default-content CSS still applies.
 * Outside the editor the result is the same as aem.js.
 * @param {Element} main The container element
 */
function decorateSections(main) {
  main.querySelectorAll(':scope > div').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if (e.tagName === 'DIV' && e.classList.contains('richtext')) {
        e.classList.remove('richtext');
        e.classList.add('default-content-wrapper');
        wrappers.push(e);
        defaultContent = false;
        return;
      }
      if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1].append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.dataset.sectionStatus = 'initialized';
    section.style.display = 'none';
  });
}

/**
 * Universal Editor: aem.js wraps block cells whose first child is not a text element in a <p>,
 * which also catches the instrumented div.richtext of column cells (<p><div>…</div></p>).
 * Unwraps those paragraphs so blocks see the cell content and the editable keeps its place.
 * @param {Element} main The main element
 */
function unwrapEditorCells(main) {
  main.querySelectorAll('.block > div > div > p:first-child').forEach((p) => {
    if (!p.querySelector(':scope > div')) return;
    p.replaceWith(...p.childNodes);
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // editor: *.ue.da.live keeps the page metadata table (hidden) in the content; it is edited
  // as page properties, so it must not be loaded as a block
  if (IS_UE) main.querySelectorAll(':scope > div > div.metadata').forEach((meta) => meta.remove());
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionMetadata(main);
  decorateBlocks(main);
  if (IS_UE) unwrapEditorCells(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'pt-BR';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  // plan cards with a SKU: Commerce express checkout (listener ready before the cards load)
  // (not in the editor: plan CTAs there must not start a purchase)
  const plans = !IS_UE && main?.querySelector('.cards-plans')
    ? import('./commerce-plans.js').then((m) => { m.default(); return m; })
    : null;
  await loadSections(main);
  plans?.then((m) => m.resumePurchase()).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('commerce-plans', e);
  });

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here

  // Adobe Brand Concierge launcher (opens the assistant drawer, links to /assistente); skipped
  // in the editor, on pages with the full-page block and with the metadata "brand-concierge: off".
  // Only the small config module loads here; the launcher code loads once the assistant is
  // configured (or with ?concierge=preview), and the chat itself only when it is opened.
  const conciergeOff = IS_UE
    || getMetadata('brand-concierge').toLowerCase() === 'off'
    || document.querySelector('.brand-concierge');
  if (!conciergeOff) {
    import('./brand-concierge-config.js')
      .then(({ getConciergeMode }) => (getConciergeMode() ? import('./brand-concierge.js') : null))
      .then((mod) => mod?.addLauncher())
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('brand-concierge', e);
      });
  }
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

// Universal Editor (Author Bus) support, loaded before the page decorates
if (IS_UE) {
  await import(`${window.hlx.codeBasePath}/ue/scripts/ue.js`).then(({ default: ue }) => ue());
}

loadPage();
