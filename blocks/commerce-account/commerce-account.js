/*
 * Customer account (Adobe Commerce account drop-in): order history, customer details and
 * sign out. Not signed in: goes to the login page and back. No authoring fields.
 */
import {
  PLANS_LINK, PLANS_PAGE, getLoginLink, getOrderLink, initializeAccount, initializeAuth,
  isAuthenticated, loadCommerceStyles, redirectTo, signOut,
} from '../../scripts/commerce.js';
import { IS_UE, showEditorPlaceholder } from '../../scripts/ue-utils.js';

/** "dd/mm/aaaa" from the drop-in's en-US "mm/dd/yyyy" order date. */
const toBrazilianDate = (date) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(`${date ?? ''}`.trim());
  return m ? `${m[2]}/${m[1]}/${m[3]}` : date;
};

/**
 * Texts the drop-in builds in code (no dictionary key): "1 itens" -> "1 item" and
 * "Cliente desde: 23/10/2026" -> "Cliente desde 23/10/2026".
 */
function fixTexts(root) {
  root.querySelectorAll('[data-testid="itemsAmount"]').forEach((p) => {
    const fixed = p.textContent.replace(/^(\s*1\s+)itens\b/, '$1item');
    if (fixed !== p.textContent) p.textContent = fixed;
  });
  root.querySelectorAll('.account-customer-information-card p').forEach((p) => {
    if (/^Cliente desde: /.test(p.textContent)) p.textContent = p.textContent.replace(': ', ' ');
  });
}

const div = (name) => {
  const d = document.createElement('div');
  d.className = `commerce-account-${name}`;
  return d;
};

export default async function decorate(block) {
  if (IS_UE) {
    showEditorPlaceholder(block, 'Minha conta: pedidos e dados do cliente conectado (exibidos no site).');
    return;
  }
  const orders = div('orders');
  orders.id = 'pedidos'; // "Meus pedidos" in the header account menu: /loja/conta#pedidos
  const details = div('details');
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'button secondary commerce-account-logout';
  logout.textContent = 'Sair da conta';
  const plans = document.createElement('a');
  plans.className = 'button primary commerce-account-plans';
  plans.href = PLANS_LINK;
  plans.textContent = 'Ver planos do Seguro Protege Casa';
  const aside = div('aside');
  aside.append(details, plans, logout);
  const wrapper = div('wrapper');
  wrapper.append(orders, aside);
  block.replaceChildren(wrapper);

  if (!isAuthenticated()) {
    await redirectTo(getLoginLink());
    return;
  }
  loadCommerceStyles();

  logout.addEventListener('click', () => {
    logout.disabled = true;
    signOut(PLANS_PAGE);
  });

  try {
    await initializeAuth();
    if (!isAuthenticated()) {
      await redirectTo(getLoginLink());
      return;
    }
    await initializeAccount();
    const [{ render }, OrdersList, CustomerInformation] = await Promise.all([
      import('@dropins/storefront-account/render.js'),
      ...['OrdersList', 'CustomerInformation']
        .map((name) => import(`@dropins/storefront-account/containers/${name}.js`).then((m) => m.default)),
    ]);
    await Promise.all([
      render.render(OrdersList, {
        withSearch: false,
        routeOrderDetails: (orderNumber) => getOrderLink(orderNumber),
        routeOrderProduct: () => PLANS_PAGE,
        routeTracking: () => '',
        slots: {
          // order date in pt-BR (the drop-in formats it en-US)
          OrdersListOrderTime: (ctx) => {
            const p = document.createElement('p');
            p.textContent = `${ctx.deliveryDateText} ${toBrazilianDate(ctx.orderDate)}`;
            ctx.replaceWith(p);
          },
        },
      })(orders),
      render.render(CustomerInformation, {})(details),
    ]);
    fixTexts(wrapper);
    new MutationObserver(() => fixTexts(wrapper))
      .observe(wrapper, { childList: true, subtree: true, characterData: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('commerce-account:', error);
    const p = document.createElement('p');
    p.className = 'commerce-account-message';
    p.setAttribute('role', 'alert');
    p.textContent = 'Não foi possível carregar a sua conta no momento. Tente novamente em instantes.';
    wrapper.replaceChildren(p);
  }
}
