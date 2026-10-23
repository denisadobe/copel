/*
 * Order details of the signed-in customer (?orderRef={order number}), Adobe Commerce order
 * drop-in. Not signed in: goes to the login page and back. No / unknown order: goes to the
 * account page. No authoring fields.
 */
import {
  ACCOUNT_PAGE, getLoginLink, initializeAuth, isAuthenticated, loadCommerceStyles,
  redirectTo,
} from '../../scripts/commerce.js';
import renderOrder from '../../scripts/commerce-order.js';

export default async function decorate(block) {
  const view = document.createElement('div');
  view.className = 'commerce-order-view';
  block.replaceChildren(view);

  const orderRef = new URLSearchParams(window.location.search).get('orderRef');
  if (!isAuthenticated()) {
    await redirectTo(getLoginLink());
    return;
  }
  if (!orderRef) {
    await redirectTo(ACCOUNT_PAGE);
    return;
  }
  loadCommerceStyles();

  try {
    await initializeAuth();
    if (!isAuthenticated()) {
      await redirectTo(getLoginLink());
      return;
    }
    const { events } = await import('@dropins/tools/event-bus.js');
    // unknown order or another customer's order
    events.on('order/error', () => window.location.replace(ACCOUNT_PAGE));
    await renderOrder(view, { orderRef });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('commerce-order:', error);
    const p = document.createElement('p');
    p.className = 'commerce-order-message';
    p.setAttribute('role', 'alert');
    p.textContent = 'Não foi possível carregar o pedido no momento. Tente novamente em instantes.';
    view.replaceChildren(p);
  }
}
