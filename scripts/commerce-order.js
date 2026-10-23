/*
 * Order view (Adobe Commerce order drop-in), shared by the order details page
 * (commerce-order block) and the checkout confirmation: order number, plan and value.
 * The plans are virtual products paid on the energy bill, so there is no shipping card, and
 * the customer details (automatic billing address, payment) are not shown.
 */
import {
  ACCOUNT_PAGE, PLANS_LINK, PLANS_PAGE, initializeOrder,
} from './commerce.js';

const el = (className, tag = 'div') => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

const link = (className, href, text) => {
  const a = el(className, 'a');
  a.href = href;
  a.textContent = text;
  return a;
};

/**
 * Renders an order into the container.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} [options.orderRef] order number of the signed-in customer
 * @param {Object} [options.orderData] data of an order just placed (order/placed event)
 * @param {boolean} [options.confirmation] "thank you" header instead of the order status
 */
export default async function renderOrder(container, { orderRef, orderData, confirmation } = {}) {
  const header = el('commerce-order-header');
  const status = el('commerce-order-status');
  const products = el('commerce-order-products');
  const summary = el('commerce-order-summary');
  const note = el('commerce-order-note', 'p');
  note.textContent = 'O valor do plano é cobrado mensalmente na sua conta de luz.';
  const actions = el('commerce-order-actions');
  const main = el('commerce-order-main');
  const aside = el('commerce-order-aside');
  main.append(confirmation ? header : status, products);
  aside.append(summary, note, actions);
  const layout = el('commerce-order-layout');
  layout.append(main, aside);
  container.replaceChildren(layout);

  await initializeOrder({ orderRef, orderData });
  const [{ render }, ...containers] = await Promise.all([
    import('@dropins/storefront-order/render.js'),
    ...['OrderHeader', 'OrderStatus', 'OrderProductList', 'OrderCostSummary']
      .map((name) => import(`@dropins/storefront-order/containers/${name}.js`).then((m) => m.default)),
  ]);
  const [OrderHeader, OrderStatus, OrderProductList, OrderCostSummary] = containers;

  await Promise.all([
    confirmation
      ? render.render(OrderHeader, { orderData })(header)
      // no cancel / reorder / return actions for the insurance plans
      : render.render(OrderStatus, { slots: { OrderActions: () => null } })(status),
    render.render(OrderProductList, { routeProductDetails: () => PLANS_PAGE })(products),
    render.render(OrderCostSummary)(summary),
  ]);

  // the status message date comes formatted en-US (mm/dd/yyyy): shown as dd/mm/aaaa
  const converted = new WeakMap(); // text node -> text already converted (runs once per text)
  const fixDate = () => {
    const walker = document.createTreeWalker(status, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (converted.get(n) !== n.data) {
        const fixed = n.data.replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, '$2/$1/$3');
        converted.set(n, fixed);
        if (fixed !== n.data) n.data = fixed;
      }
    }
  };
  if (!confirmation) {
    fixDate();
    new MutationObserver(fixDate)
      .observe(status, { childList: true, subtree: true, characterData: true });
  }

  actions.append(
    link('button primary', ACCOUNT_PAGE, 'Ir para minha conta'),
    link('button secondary', PLANS_LINK, 'Voltar ao Seguro Protege Casa'),
  );
}
