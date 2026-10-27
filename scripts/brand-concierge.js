/*
 * Adobe Brand Concierge: loads the Web SDK + Web Client on demand and mounts the chat once per
 * page — inside the brand-concierge block (full-page assistant, /assistente) or in a drawer
 * opened from the floating launcher: a native <dialog> in the top layer (above the sticky
 * header), sliding in on the right, that expands to a large centred window and links to the
 * full-page assistant. Nothing is downloaded until the chat is opened.
 * Inert until scripts/brand-concierge-config.js is filled in; ?concierge=preview renders the
 * UI with a local stub (local preview / *.aem.page only). Per page, the launcher can be turned
 * off with the metadata "brand-concierge: off".
 */
import { loadCSS, loadScript } from './aem.js';
import { sitePath } from './commerce-session.js';
import {
  ALLOY_CONFIG, ALLOY_SRC, STYLE_OVERRIDES, STYLE_URL, WEB_CLIENT_SRC, getConciergeMode,
} from './brand-concierge-config.js';

export { getConciergeMode };

const LABEL = 'Assistente virtual Copel';
const SHORT_LABEL = 'Assistente virtual';
const FULL_PAGE = '/assistente';
const MOUNT_ID = 'brand-concierge-mount';
const STYLES = () => `${window.hlx.codeBasePath}/styles/brand-concierge.css`;

let runtime;
let styling;
let mounted = false;

// shallow-by-section merge: overrides replace keys inside each top-level section
const merge = (base, extra) => Object.entries(extra).reduce((acc, [key, value]) => ({
  ...acc,
  [key]: value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(acc[key] || {}), ...value }
    : value,
}), { ...base });

async function loadStyling() {
  if (!styling) {
    styling = fetch(`${window.hlx.codeBasePath}${STYLE_URL}`)
      .then((resp) => (resp.ok ? resp.json() : {}))
      .catch(() => ({}))
      .then((exported) => {
        // keys starting with "_" are notes for the developer, not Web Client settings
        const config = Object.fromEntries(Object.entries(exported).filter(([k]) => !k.startsWith('_')));
        const behavior = merge(config.behavior || {}, STYLE_OVERRIDES.behavior);
        const disclaimer = { ...(config.disclaimer || {}), ...STYLE_OVERRIDES.disclaimer };
        const text = { ...STYLE_OVERRIDES.text, ...(config.text || {}) };
        const theme = { ...(config.theme || {}), ...STYLE_OVERRIDES.theme };
        return {
          ...config, behavior, disclaimer, text, theme,
        };
      });
  }
  return styling;
}

// Web SDK command queue (same as the "alloy" base code of the install script)
function installAlloyStub() {
  if (window.alloy) return;
  // eslint-disable-next-line no-underscore-dangle
  (window.__alloyNS = window.__alloyNS || []).push('alloy');
  const alloy = (...args) => new Promise((resolve, reject) => {
    alloy.q.push([resolve, reject, args]);
  });
  alloy.q = [];
  window.alloy = alloy;
}

function whenReady(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.adobe?.concierge?.bootstrap) resolve();
      else if (Date.now() - start > timeout) reject(new Error('Brand Concierge não carregou'));
      else setTimeout(check, 100);
    };
    check();
  });
}

function loadRuntime() {
  if (!runtime) {
    runtime = (async () => {
      installAlloyStub();
      await loadScript(ALLOY_SRC);
      await loadScript(WEB_CLIENT_SRC);
      window.alloy('configure', ALLOY_CONFIG);
      window.alloy('sendEvent', {});
      await whenReady();
    })();
  }
  return runtime;
}

/**
 * ?concierge=preview: a local stand-in for the Web Client, to test the launcher, drawer and
 * full-page layouts without Adobe scripts. Echoes a canned answer.
 * @param {HTMLElement} mount
 */
function mountPreviewStub(mount) {
  const stub = document.createElement('div');
  stub.className = 'bc-preview';

  const badge = document.createElement('p');
  badge.className = 'bc-preview-badge';
  badge.textContent = 'Pré-visualização';
  const heading = document.createElement('p');
  heading.className = 'bc-preview-heading';
  heading.textContent = 'Bem-vindo ao assistente virtual da Copel';
  const note = document.createElement('p');
  note.className = 'bc-preview-note';
  note.textContent = 'Modo de teste da interface (?concierge=preview). O chat da Adobe Brand Concierge aparece aqui quando a configuração estiver preenchida.';

  const log = document.createElement('ol');
  log.className = 'bc-preview-log';
  log.setAttribute('aria-live', 'polite');

  const form = document.createElement('form');
  form.className = 'bc-preview-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'message';
  input.autocomplete = 'off';
  input.placeholder = 'Exemplo: Como emitir a segunda via da conta?';
  input.setAttribute('aria-label', 'Digite sua mensagem');
  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Enviar';
  form.append(input, send);

  const say = (who, text) => {
    const li = document.createElement('li');
    li.className = `bc-preview-message bc-preview-${who}`;
    li.textContent = text;
    log.append(li);
    li.scrollIntoView({ block: 'nearest' });
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    say('user', text);
    input.value = '';
    setTimeout(() => say('agent', 'Resposta de exemplo (pré-visualização).'), 300);
  });

  stub.append(badge, heading, note, log, form);
  mount.append(stub);
}

/**
 * Mounts the concierge inside the given container (only the first call mounts).
 * @param {HTMLElement} container
 * @returns {Promise<boolean>} true when this call mounted the chat
 */
export async function mountConcierge(container) {
  const mode = getConciergeMode();
  if (mounted || !mode) return false;
  mounted = true;
  loadCSS(STYLES());
  const mount = document.createElement('div');
  mount.id = MOUNT_ID;
  container.append(mount);
  if (mode === 'preview') {
    mountPreviewStub(mount);
    return true;
  }
  try {
    const [stylingConfigurations] = await Promise.all([loadStyling(), loadRuntime()]);
    window.adobe.concierge.bootstrap({
      instanceName: 'alloy',
      stylingConfigurations,
      selector: `#${MOUNT_ID}`,
      stickySession: true,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('brand-concierge:', error);
    mount.textContent = 'O assistente virtual não está disponível no momento. Tente novamente mais tarde.';
    mount.classList.add('brand-concierge-error');
  }
  return true;
}

function icon(name) {
  const span = document.createElement('span');
  span.className = `brand-concierge-icon brand-concierge-icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function labelControl(control, label, iconName) {
  control.setAttribute('aria-label', label);
  control.title = label;
  control.replaceChildren(icon(iconName));
  return control;
}

function iconButton(className, label, iconName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  return labelControl(button, label, iconName);
}

/** Link to the full-page assistant (prefix-aware for the local /content/ preview). */
function fullPageHref() {
  const href = sitePath(FULL_PAGE);
  return getConciergeMode() === 'preview' ? `${href}?concierge=preview` : href;
}

/** Drawer (right side, full height) that can expand to a large centred window. */
function buildDrawer() {
  const dialog = document.createElement('dialog');
  dialog.id = 'bc-dialog';
  dialog.className = 'bc-drawer';
  dialog.setAttribute('aria-label', LABEL);

  const header = document.createElement('div');
  header.className = 'bc-drawer-header';
  // header label drawn by CSS (data-label): no text added to the page content
  const title = document.createElement('p');
  title.className = 'bc-drawer-title';
  title.dataset.label = LABEL;
  title.append(icon('sparkle'));

  const fullPage = document.createElement('a');
  fullPage.className = 'bc-drawer-fullpage';
  fullPage.href = fullPageHref();
  labelControl(fullPage, 'Abrir em página inteira', 'open-full');
  const expand = iconButton('bc-drawer-expand', 'Expandir', 'expand');
  expand.setAttribute('aria-pressed', 'false');
  const close = iconButton('bc-drawer-close', 'Fechar assistente', 'close');
  const actions = document.createElement('div');
  actions.className = 'bc-drawer-actions';
  actions.append(fullPage, expand, close);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'bc-drawer-body';
  dialog.append(header, body);
  document.body.append(dialog);

  const setExpanded = (expanded) => {
    dialog.classList.toggle('is-expanded', expanded);
    expand.setAttribute('aria-pressed', String(expanded));
    labelControl(expand, expanded ? 'Recolher' : 'Expandir', expanded ? 'collapse' : 'expand');
  };
  expand.addEventListener('click', () => setExpanded(!dialog.classList.contains('is-expanded')));
  close.addEventListener('click', () => dialog.close());
  // click on the backdrop (outside the panel) closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  return { dialog, body, close };
}

/** Floating launcher that opens the assistant drawer (only when the assistant is available). */
export function addLauncher() {
  if (!getConciergeMode() || document.querySelector('.brand-concierge-launcher')) return;
  loadCSS(STYLES());
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'brand-concierge-launcher';
  // the visible label is drawn by CSS (data-label): no text is added to the page content,
  // so AI agents read the same text as the server HTML; the button is named by aria-label
  launcher.setAttribute('aria-label', LABEL);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'bc-dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.dataset.label = SHORT_LABEL;
  launcher.append(icon('sparkle'));
  document.body.append(launcher);

  let drawer;
  launcher.addEventListener('click', () => {
    if (!drawer) {
      drawer = buildDrawer();
      drawer.dialog.addEventListener('close', () => {
        launcher.setAttribute('aria-expanded', 'false');
        launcher.hidden = false;
        launcher.focus();
      });
    }
    drawer.dialog.showModal();
    // focus starts on the close button (predictable; the chat input follows in tab order)
    drawer.close.focus();
    launcher.setAttribute('aria-expanded', 'true');
    launcher.hidden = true;
    mountConcierge(drawer.body);
  });
}
