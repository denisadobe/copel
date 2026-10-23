// desktop layout (horizontal bars + hover dropdowns) starts at this width
const isDesktop = window.matchMedia('(width >= 1200px)');

const CLOSE_DELAY = 150;
const FONT_STEP = 10;
const FONT_MIN = 100;
const FONT_MAX = 150;
const STORAGE_FONT = 'header-font-scale';
const STORAGE_CONTRAST = 'header-contrast';

let idCounter = 0;
const nextId = (prefix) => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

/**
 * Fetches the nav fragment. Metadata-independent on purpose:
 * /content first (local aem up), then the site root (DA/EDS production).
 * @returns {Promise<HTMLElement|null>} parsed fragment root
 */
async function fetchNavFragment() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const root = document.createElement('div');
  root.innerHTML = await resp.text();
  // relative media paths are relative to the fragment, not to the current page
  root.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), resp.url).href;
  });
  return root;
}

/**
 * Returns the direct label text of a list item (text nodes and <p> wrappers),
 * ignoring nested lists.
 * @param {Element} li list item
 * @returns {string} label
 */
function getOwnLabel(li) {
  return [...li.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'P'))
    .map((n) => n.textContent)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setExpanded(item, expanded) {
  const trigger = item.querySelector(':scope > .nav-trigger');
  if (!trigger) return;
  trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  item.classList.toggle('is-open', expanded);
}

function closeAllDropdowns(scope = document, except = null) {
  scope.querySelectorAll('.nav-has-sub.is-open').forEach((item) => {
    if (item !== except) setExpanded(item, false);
  });
}

/**
 * Main-menu dropdowns render as an in-place accordion inside the hamburger
 * panel (touch layouts): several can be open at once, as on the source.
 * @param {Element} li dropdown list item
 * @returns {boolean} true when the item behaves as an accordion section
 */
function isAccordion(li) {
  return !isDesktop.matches && !!li.closest('.nav-menu');
}

/**
 * Turns every list item that owns a nested list into a dropdown:
 * a trigger (existing link, or a button built from the label) + a panel list.
 * Hover opens on desktop; click/keyboard work everywhere.
 * @param {Element} list top-level <ul>
 * @param {Element} block header block (scope for closing siblings)
 */
function decorateDropdowns(list, block) {
  [...list.children].forEach((li) => {
    li.classList.add('nav-item');
    const sub = li.querySelector(':scope > ul');
    if (!sub) {
      li.querySelector(':scope > a, :scope > p > a')?.classList.add('nav-link');
      return;
    }

    li.classList.add('nav-has-sub');
    sub.classList.add('nav-dropdown');
    sub.id = nextId('nav-dropdown');
    sub.querySelectorAll('a').forEach((a) => a.classList.add('nav-sublink'));

    let trigger = li.querySelector(':scope > a, :scope > p > a');
    if (trigger) {
      const wrapper = trigger.parentElement;
      li.prepend(trigger);
      if (wrapper !== li && wrapper.tagName === 'P' && !wrapper.textContent.trim()) wrapper.remove();
    } else {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.textContent = getOwnLabel(li);
      [...li.childNodes].forEach((n) => { if (n !== sub) n.remove(); });
      li.prepend(trigger);
    }
    trigger.classList.add('nav-link', 'nav-trigger');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', sub.id);
    // caret: drawn in CSS; on touch layouts it is a separate tap target that
    // only toggles the list (the label of a link trigger can still navigate)
    const caret = document.createElement('span');
    caret.className = 'nav-caret';
    caret.setAttribute('aria-hidden', 'true');
    trigger.append(caret);

    let closeTimer;
    const open = () => {
      clearTimeout(closeTimer);
      if (!isAccordion(li)) closeAllDropdowns(block, li);
      setExpanded(li, true);
      // keep the panel inside the viewport: flip to end-alignment if it overflows
      sub.classList.remove('nav-dropdown-end');
      const overflows = sub.getBoundingClientRect().right > document.documentElement.clientWidth;
      if (!isAccordion(li) && overflows) sub.classList.add('nav-dropdown-end');
    };
    const close = () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setExpanded(li, false), CLOSE_DELAY);
    };

    li.addEventListener('mouseenter', () => { if (isDesktop.matches) open(); });
    li.addEventListener('mouseleave', () => { if (isDesktop.matches) close(); });

    trigger.addEventListener('click', (e) => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      if (trigger.tagName === 'BUTTON') {
        if (expanded) setExpanded(li, false); else open();
        return;
      }
      // link triggers navigate on desktop (as on the source). On touch layouts
      // the caret toggles the list; the label expands on the first tap and
      // follows the link on the second one.
      if (isDesktop.matches) return;
      if (e.target.closest('.nav-caret')) {
        e.preventDefault();
        if (expanded) setExpanded(li, false); else open();
      } else if (!expanded) {
        e.preventDefault();
        open();
      }
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || (trigger.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter'))) {
        e.preventDefault();
        open();
        const first = sub.querySelector('a');
        if (first) first.focus();
      }
    });

    li.addEventListener('focusout', (e) => {
      if (!isAccordion(li) && !li.contains(e.relatedTarget)) setExpanded(li, false);
    });

    sub.addEventListener('keydown', (e) => {
      const links = [...sub.querySelectorAll('a')];
      const idx = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && idx < links.length - 1) {
        e.preventDefault();
        links[idx + 1].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) links[idx - 1].focus(); else trigger.focus();
      }
    });
  });
}

function applyFontScale(scale) {
  document.documentElement.style.fontSize = scale === FONT_MIN ? '' : `${scale}%`;
  try { sessionStorage.setItem(STORAGE_FONT, String(scale)); } catch { /* storage unavailable */ }
}

function applyContrast(on, button) {
  document.body.classList.toggle('contrast', on);
  if (button) button.setAttribute('aria-pressed', on ? 'true' : 'false');
  try { sessionStorage.setItem(STORAGE_CONTRAST, on ? '1' : '0'); } catch { /* storage unavailable */ }
}

/**
 * Builds accessibility controls from a link-less list.
 * Item order defines the action: increase text, decrease text, high contrast.
 * The image alt of each item becomes the button's accessible name.
 * @param {Element} list <ul> without links
 */
function decorateA11yControls(list) {
  list.classList.add('nav-a11y-controls');
  const actions = ['font-increase', 'font-decrease', 'contrast'];
  const stored = (key) => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  };
  let scale = Number(stored(STORAGE_FONT)) || FONT_MIN;
  if (scale !== FONT_MIN) applyFontScale(scale);

  [...list.children].forEach((li, i) => {
    const action = actions[i];
    if (!action) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nav-a11y-${action}`;
    const img = li.querySelector('img');
    if (img) {
      button.setAttribute('aria-label', img.alt);
      button.title = img.alt;
      img.alt = '';
    }
    button.append(...li.childNodes);
    li.append(button);

    if (action === 'contrast') {
      applyContrast(stored(STORAGE_CONTRAST) === '1', button);
      button.addEventListener('click', () => applyContrast(!document.body.classList.contains('contrast'), button));
    } else {
      button.addEventListener('click', () => {
        const delta = action === 'font-increase' ? FONT_STEP : -FONT_STEP;
        scale = Math.min(FONT_MAX, Math.max(FONT_MIN, scale + delta));
        applyFontScale(scale);
      });
    }
  });
}

/**
 * Decorates the utility bar: links, icon link with tooltip (from the image alt),
 * accessibility controls and one labelled <nav> per link list.
 * @param {Element} section utility section from the fragment
 * @param {Element} block header block
 */
function buildUtilityBar(section, block) {
  const bar = document.createElement('div');
  bar.className = 'nav-utility';
  const inner = document.createElement('div');
  inner.className = 'nav-utility-inner';
  bar.append(inner);

  [...section.children].forEach((el) => {
    if (el.tagName === 'UL' && !el.querySelector('a')) {
      decorateA11yControls(el);
      inner.append(el);
    } else if (el.tagName === 'UL') {
      const nav = document.createElement('nav');
      nav.className = 'nav-utility-menu';
      const firstItem = el.querySelector(':scope > li');
      const ownLink = firstItem && firstItem.querySelector(':scope > a, :scope > p > a');
      const navLabel = ownLink ? ownLink.textContent.trim() : getOwnLabel(firstItem || el);
      if (navLabel) nav.setAttribute('aria-label', navLabel);
      decorateDropdowns(el, block);
      nav.append(el);
      inner.append(nav);
    } else {
      el.classList.add('nav-utility-link');
      const img = el.querySelector('a img');
      if (img) {
        const badge = document.createElement('span');
        badge.className = 'nav-badge';
        img.replaceWith(badge);
        badge.append(img);
        // the image alt (e.g. the current tariff flag) is shown as a hover tooltip;
        // it stays outside the link so the link text matches the authored label
        if (img.alt) {
          const tip = document.createElement('span');
          tip.className = 'nav-tooltip';
          tip.setAttribute('aria-hidden', 'true');
          tip.textContent = img.alt;
          el.append(tip);
        }
      }
      inner.append(el);
    }
  });
  return bar;
}

/**
 * Builds the search dialog from the tools section. The search link gives the
 * action (its empty query parameter becomes the input name), its image alt the
 * button label; the following plain paragraphs give placeholder and close label.
 * @param {Element} link search link
 * @param {string[]} texts [placeholder, closeLabel]
 * @returns {{toggle: HTMLButtonElement, dialog: HTMLDialogElement}}
 */
function buildSearch(link, texts) {
  const url = new URL(link.href);
  const [param = 'q'] = [...url.searchParams.keys()];
  const [placeholder = '', closeLabel = ''] = texts;
  const img = link.querySelector('img');
  const label = img ? img.alt : link.textContent.trim();

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-haspopup', 'dialog');
  if (img) {
    img.alt = '';
    toggle.append(img);
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'nav-search-dialog';
  dialog.id = nextId('nav-search');
  dialog.setAttribute('aria-label', label);
  toggle.setAttribute('aria-controls', dialog.id);

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = `${url.origin}${url.pathname}`;
  form.method = 'get';
  form.setAttribute('role', 'search');

  const field = document.createElement('label');
  field.className = 'nav-search-field';
  const icon = document.createElement('span');
  icon.className = 'nav-search-icon';
  icon.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'search';
  input.name = param;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', label);
  input.autocomplete = 'off';
  field.append(icon, input);
  form.append(field);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-search-close';
  close.textContent = closeLabel;

  dialog.append(close, form);

  toggle.addEventListener('click', () => {
    dialog.showModal();
    input.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => toggle.focus());

  return { toggle, dialog };
}

function buildTools(section) {
  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  let searchLink = null;
  const texts = [];
  [...section.children].forEach((el) => {
    const link = el.querySelector('a');
    if (el.tagName === 'UL') {
      el.classList.add('nav-cta-list');
      el.querySelectorAll('a').forEach((a) => a.classList.add('nav-cta'));
      tools.append(el);
    } else if (link && link.querySelector('img') && !searchLink) {
      searchLink = link;
    } else if (!link && el.textContent.trim()) {
      texts.push(el.textContent.trim());
    } else if (link) {
      tools.append(el);
    }
  });
  let dialog = null;
  if (searchLink) {
    const search = buildSearch(searchLink, texts);
    tools.append(search.toggle);
    ({ dialog } = search);
  }
  return { tools, dialog };
}

/**
 * Opens/closes the hamburger menu. As on the source the panel drops over the
 * page without locking scroll, and every accordion section is collapsed again
 * when the menu closes.
 * @param {Element} wrapper nav wrapper
 * @param {HTMLButtonElement} button hamburger button
 * @param {boolean} [force] true = open, false = close, undefined = toggle
 */
function toggleMenu(wrapper, button, force) {
  const expanded = force !== undefined ? !force : wrapper.getAttribute('aria-expanded') === 'true';
  wrapper.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  button.setAttribute('aria-label', button.dataset[expanded ? 'labelOpen' : 'labelClose']);
  if (expanded) closeAllDropdowns(wrapper.querySelector('.nav-menu') || wrapper);
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNavFragment();
  if (!fragment) return;
  block.textContent = '';

  const sections = [...fragment.children].filter((el) => el.tagName === 'DIV');
  const [utilitySection, brandSection, navSection, toolsSection] = sections.length >= 4
    ? sections
    : [null, ...sections];

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.setAttribute('aria-expanded', 'false');

  if (utilitySection) wrapper.append(buildUtilityBar(utilitySection, block));

  const mainBar = document.createElement('div');
  mainBar.className = 'nav-main-bar';
  const mainInner = document.createElement('div');
  mainInner.className = 'nav-main-inner';
  mainBar.append(mainInner);
  wrapper.append(mainBar);

  if (brandSection) {
    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    const brandLink = brandSection.querySelector('a');
    brand.append(brandLink || brandSection.firstElementChild);
    mainInner.append(brand);
  }

  const menu = document.createElement('div');
  menu.className = 'nav-menu';
  menu.id = nextId('nav-menu');
  if (navSection) {
    const nav = document.createElement('nav');
    nav.className = 'nav-sections';
    const list = navSection.querySelector('ul');
    if (list) {
      decorateDropdowns(list, block);
      nav.append(list);
    }
    menu.append(nav);
  }
  mainInner.append(menu);

  let dialog = null;
  if (toolsSection) {
    const built = buildTools(toolsSection);
    mainInner.append(built.tools);
    ({ dialog } = built);
  }

  // hamburger (touch layouts; hidden on desktop)
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  const hamburgerButton = document.createElement('button');
  hamburgerButton.type = 'button';
  hamburgerButton.setAttribute('aria-controls', menu.id);
  hamburgerButton.dataset.labelOpen = 'Abrir menu';
  hamburgerButton.dataset.labelClose = 'Fechar menu';
  const hamburgerIcon = document.createElement('span');
  hamburgerIcon.className = 'nav-hamburger-icon';
  hamburgerButton.append(hamburgerIcon);
  hamburger.append(hamburgerButton);
  mainInner.append(hamburger);
  toggleMenu(wrapper, hamburgerButton, false);
  hamburgerButton.addEventListener('click', () => toggleMenu(wrapper, hamburgerButton));

  block.append(wrapper);
  if (dialog) block.append(dialog);

  // global close behaviors
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = block.querySelector('.nav-has-sub.is-open');
    if (open) {
      setExpanded(open, false);
      open.querySelector(':scope > .nav-trigger').focus();
    } else if (!isDesktop.matches && wrapper.getAttribute('aria-expanded') === 'true') {
      toggleMenu(wrapper, hamburgerButton, false);
      hamburgerButton.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (block.contains(e.target)) return;
    closeAllDropdowns(block);
    // tapping outside the header closes the hamburger menu (as on the source)
    if (!isDesktop.matches && wrapper.getAttribute('aria-expanded') === 'true') {
      toggleMenu(wrapper, hamburgerButton, false);
    }
  });

  // switching layouts resets transient state
  isDesktop.addEventListener('change', () => {
    closeAllDropdowns(block);
    toggleMenu(wrapper, hamburgerButton, false);
  });
}
