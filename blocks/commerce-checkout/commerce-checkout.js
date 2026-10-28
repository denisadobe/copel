/*
 * Express checkout for the Seguro Protege Casa plans (Adobe Commerce checkout drop-in).
 * The plans are virtual products paid on the energy bill: no shipping, no payment form.
 * The customer sees their details, the chosen plan, the payment method ("Cobrança na fatura
 * de energia", offline method checkmo) and confirms. Commerce always requires a billing
 * address (with telephone), so it is filled in automatically: the customer's default billing
 * address or a neutral address with the customer's name.
 * After the order: confirmation in place, the URL moves to the order details page.
 * Not signed in: login page and back. Empty cart: message with a link to the plans.
 * No authoring fields.
 */
import {
  CORE_FETCH_GRAPHQL, PLANS_LINK, PLANS_PAGE, getLoginLink, getOrderLink, initializeCart,
  initializeCheckout, initializeOrder, isAuthenticated, loadCommerceStyles, redirectTo,
  sanitizeName, signOut,
} from '../../scripts/commerce.js';
import renderOrder from '../../scripts/commerce-order.js';
import { markProtegeCasaCustomer } from '../../scripts/target-profile.js';
import { IS_UE, showEditorPlaceholder } from '../../scripts/ue-utils.js';

/** Offline method whose Admin title is "Cobrança na fatura de energia". */
const PAYMENT_METHOD = 'checkmo';
const PAYMENT_TITLE = 'Cobrança na fatura de energia';

// Billing address used when the customer has none saved (virtual order: nothing is shipped)
const EXPRESS_BILLING_ADDRESS = {
  street: ['Rua José Izidoro Biazetto, 158'],
  city: 'Curitiba',
  region: 'PR',
  postcode: '81200-240',
  countryCode: 'BR',
};
const DEFAULT_TELEPHONE = '4133310000';
const CONFIRMED_TITLE = 'Pedido confirmado';

const el = (name, tag = 'div') => {
  const e = document.createElement(tag);
  e.className = `commerce-checkout-${name}`;
  return e;
};

const text = (name, tag, content) => {
  const e = el(name, tag);
  e.textContent = content;
  return e;
};

/** Friendly message (+ optional link) in place of the checkout. */
function message(wrapper, content, linkText, href) {
  const box = el('message');
  box.append(text('message-text', 'p', content));
  if (linkText) {
    const a = text('message-link', 'a', linkText);
    a.className = 'button primary';
    a.href = href;
    const p = el('message-action', 'p');
    p.append(a);
    box.append(p);
  }
  wrapper.replaceChildren(box);
}

/** Payment method of an express order: checkmo, or the first offline method available. */
function pickPaymentMethod(data) {
  const methods = (data?.availablePaymentMethods || [])
    .filter((m) => !/^payment_services_|braintree|paypal/.test(m.code));
  return methods.find((m) => m.code === PAYMENT_METHOD) || methods[0];
}

async function getCustomer() {
  const { data } = await CORE_FETCH_GRAPHQL.fetchGraphQl(`{
    customer {
      firstname lastname email default_billing
      addresses { id telephone default_billing }
    }
  }`, { method: 'POST' });
  return data?.customer || {};
}

export default async function decorate(block) {
  if (IS_UE) {
    showEditorPlaceholder(block, 'Checkout: exibido no site para o cliente conectado com um plano no carrinho.');
    return;
  }
  const $ = Object.fromEntries([
    'error', 'stock', 'customer', 'payment', 'place-order', 'terms', 'items', 'summary',
  ].map((name) => [name, el(name)]));
  const main = el('main');
  main.append($.error, $.stock, $.customer, $.payment, $.terms, $['place-order']);
  const aside = el('aside');
  aside.append(text('aside-title', 'h2', 'Plano escolhido'), $.items, $.summary);
  const wrapper = el('wrapper');
  wrapper.append(main, aside);
  block.replaceChildren(wrapper);

  if (!isAuthenticated()) {
    await redirectTo(getLoginLink());
    return;
  }
  loadCommerceStyles();
  const loading = text('loading', 'p', 'Carregando…');
  main.prepend(loading);

  try {
    await Promise.all([initializeCart(), initializeCheckout(), initializeOrder()]);
    if (!isAuthenticated()) {
      // the session expired (token checked by the auth drop-in)
      await redirectTo(getLoginLink());
      return;
    }
    const [
      { events },
      { placeOrder },
      { setBillingAddress, setPaymentMethod },
      { render: checkout },
      { render: cart },
      [ServerError, OutOfStock, PlaceOrder],
      [OrderSummary, CartSummaryList],
      customer,
    ] = await Promise.all([
      import('@dropins/tools/event-bus.js'),
      import('@dropins/storefront-order/api.js'),
      import('@dropins/storefront-checkout/api.js'),
      import('@dropins/storefront-checkout/render.js'),
      import('@dropins/storefront-cart/render.js'),
      Promise.all(['ServerError', 'OutOfStock', 'PlaceOrder']
        .map((name) => import(`@dropins/storefront-checkout/containers/${name}.js`).then((m) => m.default))),
      Promise.all(['OrderSummary', 'CartSummaryList']
        .map((name) => import(`@dropins/storefront-cart/containers/${name}.js`).then((m) => m.default))),
      getCustomer(),
    ]);

    let placing = false;
    let checkoutData;

    // empty cart (and no order being placed): friendly message, back to the plans
    const checkCart = (data) => {
      if (placing || events.lastPayload('order/placed')) return;
      if (!data || !data.items?.length) {
        message(wrapper, 'Você ainda não escolheu um plano do Seguro Protege Casa.', 'Ver planos', PLANS_LINK);
      } else if (data.isVirtual === false) {
        message(wrapper, 'O carrinho tem itens que não são planos do Seguro Protege Casa.', 'Ver planos', PLANS_LINK);
      }
    };
    events.on('cart/initialized', checkCart, { eager: true });
    events.on('cart/data', checkCart);
    // signed out in another tab / token expired: back to the login page
    events.on('authenticated', (authenticated) => {
      if (!authenticated) window.location.replace(getLoginLink());
    });

    // customer details (the order goes to this account)
    const name = [customer.firstname, customer.lastname].filter(Boolean).join(' ');
    const signOutButton = text('signout', 'button', 'Não é você? Sair');
    signOutButton.type = 'button';
    signOutButton.addEventListener('click', () => {
      signOutButton.disabled = true;
      signOut(PLANS_LINK);
    });
    $.customer.append(
      text('step-title', 'h2', 'Seus dados'),
      ...(name ? [text('customer-name', 'p', name)] : []),
      text('customer-email', 'p', customer.email || ''),
      signOutButton,
    );

    // payment: offline method (title set in the Admin), charged on the energy bill
    const paymentTitle = text('payment-title', 'p', PAYMENT_TITLE);
    $.payment.append(
      text('step-title', 'h2', 'Forma de pagamento'),
      paymentTitle,
      text('payment-note', 'p', 'O valor mensal do plano vem na sua conta de luz. '
        + 'Não é preciso informar cartão nem endereço.'),
    );
    const showPayment = (data) => {
      if (!data) return;
      checkoutData = data;
      const method = pickPaymentMethod(data);
      const useTitle = method?.code === PAYMENT_METHOD && method.title;
      paymentTitle.textContent = useTitle ? method.title : PAYMENT_TITLE;
    };
    events.on('checkout/initialized', showPayment, { eager: true });
    events.on('checkout/updated', showPayment);

    // billing address + payment method set right before placing the order
    const prepareExpressOrder = async () => {
      const saved = customer.addresses?.find((a) => a.default_billing)
        || customer.addresses?.find((a) => `${a.id}` === `${customer.default_billing}`)
        || customer.addresses?.[0];
      const billing = saved?.id ? { customerAddressId: Number(saved.id) } : {
        address: {
          ...EXPRESS_BILLING_ADDRESS,
          firstName: sanitizeName(customer.firstname, 'Cliente'),
          lastName: sanitizeName(customer.lastname, 'Copel'),
          telephone: DEFAULT_TELEPHONE,
        },
      };
      const updated = await setBillingAddress(billing);
      const method = pickPaymentMethod(updated || checkoutData);
      if (!method) throw new Error('Nenhuma forma de pagamento disponível.');
      await setPaymentMethod({ code: method.code });
    };

    await Promise.all([
      checkout.render(ServerError, {
        autoScroll: true,
        onRetry: () => wrapper.classList.remove('has-error'),
        onServerError: () => wrapper.classList.add('has-error'),
      })($.error),
      checkout.render(OutOfStock, { routeCart: () => PLANS_LINK })($.stock),
      checkout.render(PlaceOrder, {
        handleValidation: () => true,
        handlePlaceOrder: async ({ cartId }) => {
          placing = true;
          wrapper.classList.add('is-placing');
          try {
            await prepareExpressOrder();
            await placeOrder(cartId);
          } catch (error) {
            placing = false;
            throw error;
          } finally {
            wrapper.classList.remove('is-placing');
          }
        },
      })($['place-order']),
      cart.render(CartSummaryList, {
        variant: 'secondary',
        hideHeading: true,
        enableRemoveItem: false,
        enableUpdateItemQuantity: false,
        routeProduct: () => PLANS_PAGE,
      })($.items),
      cart.render(OrderSummary, {})($.summary),
    ]);
    $.terms.append(text('terms-text', 'p', 'Ao confirmar, você contrata o plano escolhido com '
      + 'cobrança mensal na sua conta de luz, conforme as Condições Gerais do Seguro Protege Casa.'));
    loading.remove();

    // order placed: confirmation in place, URL of the order details (reload-safe)
    events.on('order/placed', async (orderData) => {
      // Adobe Target: the home now shows the post-sale banner (scripts/target-profile.js)
      markProtegeCasaCustomer();
      window.history.pushState({}, '', getOrderLink(orderData.number));
      // the page now shows the order: heading + title of a confirmation
      const heading = document.querySelector('main h1');
      if (heading) heading.textContent = CONFIRMED_TITLE;
      document.title = document.title.includes(' - ')
        ? `${CONFIRMED_TITLE} - ${document.title.split(' - ').slice(1).join(' - ')}`
        : CONFIRMED_TITLE;
      window.scrollTo(0, 0);
      const confirmation = el('confirmation');
      block.replaceChildren(confirmation);
      await renderOrder(confirmation, { orderData, confirmation: true });
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('commerce-checkout:', error);
    message(wrapper, 'Não foi possível carregar a contratação no momento. '
      + 'Tente novamente em instantes.', 'Voltar aos planos', PLANS_LINK);
  }
}
