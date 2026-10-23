/*
 * "Quero o Plano ..." buttons of the cards-plans block -> Commerce express checkout.
 * Loaded by scripts.js only on pages with a cards-plans block. The block dispatches the
 * cancelable 'cards-plans:select' event ({ sku, plan, price, href, card, link }); for a card
 * with a SKU this listener cancels the link and:
 *   1. not signed in: goes to /loja/entrar?redirect=<this page>#planos&sku=<sku>; after sign in
 *      the login page comes back here with ?contratar=<sku> and the purchase resumes;
 *   2. replaces the cart contents with that plan (quantity 1);
 *   3. goes to /loja/checkout.
 * Commerce code only loads on the click (or on the resume).
 */

export const SELECT_EVENT = 'cards-plans:select';
/** Query parameter of the page after sign in: plan to resume. */
export const RESUME_PARAM = 'contratar';

const BUSY_TEXT = 'Aguarde…';
const ERROR_TEXT = 'Não foi possível contratar o plano agora. Tente novamente em instantes.';

let busy = false;

function setLoading(link, loading) {
  if (!link) return;
  if (loading) {
    link.dataset.label = link.dataset.label || link.textContent;
    link.textContent = BUSY_TEXT;
    link.setAttribute('aria-busy', 'true');
    link.setAttribute('aria-disabled', 'true');
  } else {
    if (link.dataset.label) link.textContent = link.dataset.label;
    link.removeAttribute('aria-busy');
    link.removeAttribute('aria-disabled');
  }
}

function showError(link, text) {
  const cell = link?.closest('.cards-plans-cta') || link?.parentElement;
  if (!cell) return;
  let message = cell.querySelector('.commerce-plans-error');
  if (!message) {
    message = document.createElement('p');
    // reuses the block's note style: no new visuals on the plans page
    message.className = 'cards-plans-note commerce-plans-error';
    message.setAttribute('role', 'alert');
    cell.append(message);
  }
  message.textContent = text;
}

/** This page, without the resume parameter, anchored at the plans. */
function backToPlans() {
  const url = new URL(window.location.href);
  url.searchParams.delete(RESUME_PARAM);
  return `${url.pathname}${url.search}#planos`;
}

async function purchase(sku, link) {
  if (busy) return;
  busy = true;
  setLoading(link, true);
  link?.closest('.cards-plans-cta')?.querySelector('.commerce-plans-error')?.remove();
  try {
    const commerce = await import('./commerce.js');
    if (!commerce.isAuthenticated()) {
      window.location.href = commerce.getLoginLink(backToPlans(), sku);
      return;
    }
    await commerce.replaceCartWith(sku);
    // the session may have expired meanwhile (token checked by the auth drop-in)
    if (!commerce.isAuthenticated()) {
      window.location.href = commerce.getLoginLink(backToPlans(), sku);
      return;
    }
    window.location.href = commerce.CHECKOUT_PAGE;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('commerce-plans:', error);
    busy = false;
    setLoading(link, false);
    showError(link, ERROR_TEXT);
  }
}

const findLink = (sku) => [...document.querySelectorAll('.cards-plans .cards-plans-card[data-sku]')]
  .find((card) => card.dataset.sku.toLowerCase() === sku.toLowerCase())
  ?.querySelector('.cards-plans-select');

/** Back from the login page with ?contratar=<sku>: continue the purchase (blocks loaded). */
export function resumePurchase() {
  const url = new URL(window.location.href);
  const sku = url.searchParams.get(RESUME_PARAM);
  if (!sku) return;
  url.searchParams.delete(RESUME_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  const link = findLink(sku);
  if (!link) return;
  link.closest('.cards-plans-card')?.scrollIntoView({ block: 'center' });
  purchase(link.closest('.cards-plans-card').dataset.sku, link);
}

export default function initPlans() {
  document.addEventListener(SELECT_EVENT, (e) => {
    const { sku, link } = e.detail || {};
    if (!sku) return; // no SKU authored: the link navigates as usual
    e.preventDefault();
    purchase(sku, link);
  });
}
