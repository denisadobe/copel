/**
 * Fetches the footer fragment. Metadata-independent on purpose:
 * /content first (local aem up), then the site root (DA/EDS production).
 * @returns {Promise<HTMLElement|null>} parsed fragment root
 */
async function fetchFooterFragment() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const root = document.createElement('div');
  root.innerHTML = await resp.text();
  // relative media paths are relative to the fragment, not to the current page
  root.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), resp.url).href;
  });
  return root;
}

const HEADING = 'H1, H2, H3, H4, H5, H6';

/**
 * True when the element holds media but no visible text.
 * @param {Element} el element
 * @returns {boolean}
 */
function isMediaOnly(el) {
  return !!el.querySelector('img, picture, svg') && !el.textContent.trim();
}

/**
 * True for a list whose every item is a single media-only link (icon row).
 * @param {Element} el element
 * @returns {boolean}
 */
function isIconList(el) {
  if (el.tagName !== 'UL' && el.tagName !== 'OL') return false;
  const items = [...el.children];
  return items.length > 0 && items.every((li) => {
    const a = li.querySelector('a');
    return a && isMediaOnly(a) && li.textContent.trim() === '';
  });
}

/**
 * True for a section that only holds an in-page "#" link (back to top).
 * @param {Element} section fragment section
 * @returns {boolean}
 */
function isBackToTopSection(section) {
  const links = section.querySelectorAll('a');
  if (links.length !== 1 || section.querySelector('img, picture, svg')) return false;
  const href = links[0].getAttribute('href') || '';
  return href === '#' || href === '#top';
}

/**
 * Names a content group from what it contains.
 * @param {Element[]} nodes group children
 * @returns {string} css class
 */
function groupClass(nodes) {
  const [first] = nodes;
  if (first.matches(HEADING)) return 'footer-column';
  if (isIconList(first)) return 'footer-social';
  if (first.tagName === 'UL' || first.tagName === 'OL') return 'footer-links';
  if (isMediaOnly(first)) return first.querySelector('a') ? 'footer-badge' : 'footer-brand';
  return 'footer-text';
}

/**
 * Splits a flat fragment section into layout groups: every heading opens a
 * column that takes the following content until the next heading or a second
 * list; anything outside a heading column is a group of its own.
 * @param {Element} section fragment section
 * @returns {Element[][]} groups of nodes
 */
function groupSectionContent(section) {
  const groups = [];
  let current = null;
  [...section.children].forEach((el) => {
    const isList = el.tagName === 'UL' || el.tagName === 'OL';
    if (el.matches(HEADING)) {
      current = [el];
      groups.push(current);
    } else if (current && !(isList && current.some((n) => n.tagName === 'UL' || n.tagName === 'OL'))) {
      current.push(el);
    } else {
      groups.push([el]);
      current = null;
    }
  });
  return groups;
}

/**
 * Inlines an SVG icon so it can inherit currentColor (hover colour).
 * Keeps the original <img> when the file is not a usable SVG.
 * @param {HTMLImageElement} img icon image
 */
async function inlineSvgIcon(img) {
  if (!/\.svg(\?|$)/i.test(img.src)) return;
  try {
    const resp = await fetch(img.src);
    if (!resp.ok) return;
    const doc = new DOMParser().parseFromString(await resp.text(), 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return;
    svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    [svg, ...svg.querySelectorAll('*')].forEach((n) => {
      [...n.attributes].filter((a) => /^on/i.test(a.name)).forEach((a) => n.removeAttribute(a.name));
    });
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('footer-icon');
    img.replaceWith(document.importNode(svg, true));
  } catch {
    // keep the <img> fallback
  }
}

/**
 * Turns an icon list into accessible social links.
 * @param {Element} list icon list
 * @returns {Promise<void>}
 */
function decorateSocial(list) {
  const pending = [];
  list.querySelectorAll('a').forEach((a) => {
    const img = a.querySelector('img');
    if (img && img.alt && !a.getAttribute('aria-label')) a.setAttribute('aria-label', img.alt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (img) {
      img.alt = '';
      pending.push(inlineSvgIcon(img));
    }
  });
  return Promise.all(pending);
}

/**
 * Builds the back-to-top control from the fragment link (label stays authored).
 * @param {Element} section fragment section
 */
function decorateBackToTop(section) {
  section.className = 'footer-back-to-top';
  const link = section.querySelector('a');
  const label = link.textContent.trim();
  link.className = 'footer-back-to-top-link';
  link.textContent = '';
  const text = document.createElement('span');
  text.className = 'footer-sr-only';
  text.textContent = label;
  link.append(text);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  // the back-to-top section is a wrapper of the button only
  const p = link.closest('p');
  if (p) p.replaceWith(link);
}

/**
 * Lays out a content section as a grid of groups.
 * @param {Element} section fragment section
 * @returns {Promise<void>}
 */
function decorateContentSection(section) {
  section.className = 'footer-main';
  const grid = document.createElement('div');
  grid.className = 'footer-grid';
  const pending = [];
  groupSectionContent(section).forEach((nodes) => {
    const group = document.createElement('div');
    group.className = `footer-group ${groupClass(nodes)}`;
    group.append(...nodes);
    if (group.classList.contains('footer-social')) pending.push(decorateSocial(nodes[0]));
    grid.append(group);
  });
  section.replaceChildren(grid);
  return Promise.all(pending);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooterFragment();
  if (!fragment) return;

  const pending = [];
  const sections = [...fragment.children].filter((el) => el.tagName === 'DIV');
  sections.forEach((section) => {
    if (isBackToTopSection(section)) decorateBackToTop(section);
    else pending.push(decorateContentSection(section));
  });

  block.replaceChildren(...sections);
  await Promise.all(pending);
}
