/*
 * Adobe Commerce wiring for the Copel store (drop-ins): storefront config (/config.json),
 * the GraphQL client shared by every drop-in, the customer session, pt-BR labels and the
 * store pages. Drop-ins are initialized on demand, once per page.
 * Scope: one service (Seguro Protege Casa), virtual products, express checkout, Commerce
 * customer login only.
 */
import { getHeaders, getConfigValue, initializeConfig } from '@dropins/tools/lib/aem/configs.js';
import { FetchGraphQL } from '@dropins/tools/fetch-graphql.js';
import { initializers } from '@dropins/tools/initializer.js';
import { loadCSS } from './aem.js';
import {
  getStorefrontConfig, getUserToken, isAuthenticated, sitePath,
} from './commerce-session.js';

// customer session + site paths live in a drop-in-free module (also used by the header)
export {
  getCustomerFirstName, getUserToken, isAuthenticated, sitePath,
} from './commerce-session.js';

/** GraphQL client (Core + Catalog Service share one endpoint on the SaaS sandbox). */
export const CORE_FETCH_GRAPHQL = new FetchGraphQL();

export const LOCALE = 'pt-BR';

/* ---------------------------------------------------------------------------------------- */
/* Store pages                                                                               */
/* ---------------------------------------------------------------------------------------- */

export const LOGIN_PAGE = sitePath('/loja/entrar');
export const SIGNUP_PAGE = sitePath('/loja/cadastro');
export const FORGOT_PASSWORD_PAGE = sitePath('/loja/esqueci-senha');
export const ACCOUNT_PAGE = sitePath('/loja/conta');
export const ORDER_PAGE = sitePath('/loja/conta/pedido');
export const CHECKOUT_PAGE = sitePath('/loja/checkout');
/** The page that sells the plans (empty cart, "see plans" links, product links). */
export const PLANS_PAGE = sitePath('/seguro-protege-casa');
export const PLANS_LINK = `${PLANS_PAGE}#planos`;

/** Link to an order of the signed-in customer. */
export const getOrderLink = (orderNumber) => `${ORDER_PAGE}?orderRef=${encodeURIComponent(orderNumber)}`;

/**
 * Leaves the page (replace: no history entry). The returned promise never settles, so a
 * block that awaits it stops the page load (no header / footer requests cut short).
 */
export function redirectTo(url) {
  window.location.replace(url);
  return new Promise(() => {});
}

/** Same-site path (no protocol-relative URLs). */
const isSafePath = (path) => typeof path === 'string' && /^\/(?![/\\])/.test(path);

/** A SKU from the URL (?sku=), letters, digits, - and _ only. */
export const isValidSku = (sku) => typeof sku === 'string' && /^[\w-]{1,64}$/.test(sku);

/** Same-site path from ?redirect= (after sign in), or the fallback. */
export function getRedirect(fallback = ACCOUNT_PAGE) {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  return isSafePath(redirect) ? redirect : fallback;
}

/**
 * Login page that comes back to `back` after sign in (default: the current page).
 * With a SKU, the plan purchase resumes after sign in (see scripts/commerce-plans.js).
 */
export function getLoginLink(back, sku) {
  const { pathname, search } = window.location;
  const params = new URLSearchParams({ redirect: back || pathname + search });
  if (sku) params.set('sku', sku);
  return `${LOGIN_PAGE}?${params}`;
}

/* ---------------------------------------------------------------------------------------- */
/* Customer session                                                                          */
/* ---------------------------------------------------------------------------------------- */

/**
 * Commerce rejects customer names with "+" and most symbols: keep letters (any language),
 * spaces, apostrophes, hyphens and dots, collapse spaces and cap the length.
 */
export function sanitizeName(name, fallback = '') {
  const clean = `${name ?? ''}`
    .replace(/[^\p{L}\p{M}' .-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
  return clean || fallback;
}

/* ---------------------------------------------------------------------------------------- */
/* GraphQL hooks                                                                             */
/* ---------------------------------------------------------------------------------------- */

// customer name fields sent by the auth / account drop-ins (sign up, edit details)
const NAME_MUTATIONS = /\b(createCustomer|createCustomerV2|updateCustomer|updateCustomerV2)\b/;
const NAME_FIELDS = ['firstname', 'lastname', 'middlename'];

function sanitizeNamesInRequest(options) {
  if (typeof options?.body !== 'string') return options;
  try {
    const body = JSON.parse(options.body);
    if (!NAME_MUTATIONS.test(body.query || '')) return options;
    const input = body.variables?.input;
    if (!input) return options;
    NAME_FIELDS.forEach((field) => {
      if (typeof input[field] === 'string') input[field] = sanitizeName(input[field], input[field]);
    });
    return { ...options, body: JSON.stringify(body) };
  } catch (e) {
    return options;
  }
}

/*
 * DEMO ONLY: the sandbox store runs in USD, the demo must show Brazilian reais. Every GraphQL
 * response gets its currency codes rewritten USD -> BRL (same numbers), so the drop-ins format
 * "R$ 24,90" with the pt-BR locale. Orders stay in USD in the Admin. Remove this hook once the
 * store has a BRL website / currency.
 */
const DISPLAY_CURRENCY = { from: 'USD', to: 'BRL' };
function rewriteCurrency(value, key = '') {
  if (Array.isArray(value)) return value.map((v) => rewriteCurrency(v, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteCurrency(v, k)]));
  }
  return value === DISPLAY_CURRENCY.from && /currency/i.test(key) ? DISPLAY_CURRENCY.to : value;
}

/*
 * Form field labels come from the store attributes (en_US store view), not from the drop-in
 * dictionaries: the sign up / account / address forms get pt-BR labels here (and the
 * en_US "remote shopping assistance" consent is turned off).
 */
const FIELD_LABELS = {
  firstname: 'Nome',
  middlename: 'Nome do meio',
  lastname: 'Sobrenome',
  email: 'Email',
  prefix: 'Tratamento',
  suffix: 'Sufixo',
  dob: 'Data de nascimento',
  gender: 'Gênero',
  taxvat: 'CPF',
  vat_id: 'CPF/CNPJ',
  company: 'Empresa',
  telephone: 'Telefone',
  fax: 'Fax',
  street: 'Endereço',
  city: 'Cidade',
  region: 'Estado',
  region_id: 'Estado',
  postcode: 'CEP',
  country_id: 'País',
};
function localizeForms(response) {
  const items = response?.data?.attributesForm?.items;
  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (FIELD_LABELS[item?.code]) item.label = FIELD_LABELS[item.code];
    });
  }
  // "Login as Customer" consent (en_US text from the store config): not offered by Copel
  const storeConfig = response?.data?.storeConfig;
  if (storeConfig && 'shopping_assistance_enabled' in storeConfig) {
    storeConfig.shopping_assistance_enabled = false;
  }
  return response;
}

/*
 * Commerce GraphQL error messages (en_US store) shown as-is by the auth / account drop-ins:
 * the common sign in / sign up / password / session ones in pt-BR. Unknown messages pass
 * through. Left in English on purpose: "This account isn't confirmed..." (the auth drop-in
 * matches it and shows its own pt-BR text + resend button) and the change-password responses
 * (the account drop-in matches "Invalid login or password." / "The account is locked.").
 */
const ERROR_MESSAGES = [
  [/^The account sign-in was incorrect or your account is disabled temporarily\. Please wait and try again(?: later)?\.?$/i,
    'E-mail ou senha incorretos, ou a conta está temporariamente bloqueada. Confira os dados ou aguarde alguns minutos e tente novamente.'],
  [/^Invalid login or password\.?$/i, 'E-mail ou senha inválidos.'],
  [/^The account is locked\.?$/i, 'A sua conta está bloqueada. Tente novamente mais tarde.'],
  [/^This account is disabled\.?$/i, 'A sua conta está desativada.'],
  [/^A customer with the same email address already exists in an associated website\.?$/i,
    'Já existe uma conta com este e-mail. Entre com a sua senha ou use "Esqueceu a senha?".'],
  [/^There is already an account with this email address\.?/i,
    'Já existe uma conta com este e-mail. Entre com a sua senha ou use "Esqueceu a senha?".'],
  [/^"(.+)" is not a valid email address\.?$/i, '"$1" não é um e-mail válido.'],
  [/^The password needs at least (\d+) characters\. Create a new password and try again\.?$/i,
    'A senha precisa ter pelo menos $1 caracteres. Crie uma nova senha e tente novamente.'],
  [/^Minimum of different classes of characters in password is (\d+)\. Classes of characters: Lower Case, Upper Case, Digits, Special Characters\.?$/i,
    'A senha precisa combinar pelo menos $1 tipos de caracteres: letras minúsculas, letras maiúsculas, números e caracteres especiais.'],
  [/^The password can't be the same as the email address\. Create a new password and try again\.?$/i,
    'A senha não pode ser igual ao e-mail. Crie uma nova senha e tente novamente.'],
  [/^Please enter a password with at most (\d+) characters\.?$/i, 'A senha pode ter no máximo $1 caracteres.'],
  [/^Your password reset link has expired\.?$/i, 'O link para criar uma nova senha expirou. Solicite um novo link.'],
  [/^The password token is mismatched\. Reset and try again\.?$/i,
    'O link para criar uma nova senha é inválido. Solicite um novo link.'],
  [/^User token has been revoked\.?$/i, 'A sua sessão foi encerrada. Entre novamente.'],
  [/^The current customer isn't authorized\.?$/i, 'A sua sessão expirou. Entre novamente.'],
  [/^The request is allowed for logged in customer\.?$/i, 'Entre na sua conta para continuar.'],
];
// responses whose English messages a drop-in compares (see above)
const KEEP_ERRORS_FOR = /\bchangeCustomerPassword\b/;

const translateError = (message) => {
  const text = `${message}`.trim();
  const match = ERROR_MESSAGES.find(([pattern]) => pattern.test(text));
  return match ? text.replace(match[0], match[1]) : message;
};

function localizeErrors(options, response) {
  if (!Array.isArray(response?.errors) || !response.errors.length) return response;
  if (typeof options?.body === 'string' && KEEP_ERRORS_FOR.test(options.body)) return response;
  response.errors.forEach((error) => {
    if (typeof error?.message === 'string') error.message = translateError(error.message);
  });
  return response;
}

/** Image used when a product has no image (the store returns the Magento placeholder). */
export const PRODUCT_FALLBACK_IMAGE = 'https://www.copel.com/site/wp-content/uploads/elementor/thumbs/Protege_Casa-qyxw0cz5qsdhv7z2sdyk37e5x0k09u35a2z0gh6z7c.png';
const IMAGE_KEYS = /^(thumbnail|small_image|smallImage|image|swatch_image)$/;
const isPlaceholder = (url) => !url || /\/placeholder\//.test(url);

// order status labels of the orders list (en_US labels from the store)
const ORDER_STATUS = {
  pending: 'Pendente',
  processing: 'Em processamento',
  complete: 'Concluído',
  canceled: 'Cancelado',
  closed: 'Encerrado',
  'on hold': 'Em espera',
  holded: 'Em espera',
  'suspected fraud': 'Em análise',
  'payment review': 'Em análise',
  'pending payment': 'Aguardando pagamento',
};

/**
 * Display tweaks on the responses, all in one walk: zero discounts dropped (no "-R$ 0,00"
 * row), the Copel fallback image instead of the placeholder, pt-BR order status in the orders
 * list, and the customer creation date as dd/mm/aaaa ("Cliente desde").
 */
function polishValue(value, key, ctx) {
  if (Array.isArray(value)) {
    const list = key === 'discounts'
      ? value.filter((d) => Number(d?.amount?.value ?? d?.value) !== 0)
      : value;
    return list.map((v) => polishValue(v, '', ctx));
  }
  if (!value || typeof value !== 'object') return value;
  if (IMAGE_KEYS.test(key) && 'url' in value && isPlaceholder(value.url)) {
    value.url = PRODUCT_FALLBACK_IMAGE;
  }
  Object.keys(value).forEach((k) => {
    value[k] = polishValue(value[k], k, ctx);
  });
  if (ctx.ordersList && typeof value.status === 'string' && 'number' in value) {
    value.status = ORDER_STATUS[value.status.toLowerCase()] || value.status;
  }
  return value;
}

function polishResponse(options, response) {
  // the account orders list (GET request): only that query asks for date_of_first_order
  const ctx = { ordersList: !!response?.data?.customer?.orders?.date_of_first_order };
  const result = polishValue(response, '', ctx);
  const customer = result?.data?.customer;
  const created = /^(\d{4})-(\d{2})-(\d{2})/.exec(customer?.created_at || '');
  if (created) customer.created_at = `${created[3]}/${created[2]}/${created[1]}`;
  return result;
}

/* ---------------------------------------------------------------------------------------- */
/* Initialization                                                                            */
/* ---------------------------------------------------------------------------------------- */

/** Drop-in design tokens mapped to the Copel brand (only pages that render drop-ins). */
export const loadCommerceStyles = () => loadCSS(`${window.hlx.codeBasePath}/styles/commerce.css`);

let ready;

/** Initializes config + GraphQL client once per page. */
export function initializeCommerce() {
  if (!ready) {
    ready = (async () => {
      initializeConfig(await getStorefrontConfig());
      initializers.setGlobalLocale(LOCALE);
      CORE_FETCH_GRAPHQL.setEndpoint(getConfigValue('commerce-core-endpoint') || getConfigValue('commerce-endpoint'));
      CORE_FETCH_GRAPHQL.setFetchGraphQlHeaders((prev) => ({ ...prev, ...getHeaders('all') }));
      CORE_FETCH_GRAPHQL.addBeforeHook(sanitizeNamesInRequest);
      CORE_FETCH_GRAPHQL.addAfterHook((options, response) => rewriteCurrency(response));
      CORE_FETCH_GRAPHQL.addAfterHook((options, response) => localizeForms(response));
      CORE_FETCH_GRAPHQL.addAfterHook(polishResponse);
      CORE_FETCH_GRAPHQL.addAfterHook(localizeErrors);

      // signed-in customer: requests carry the customer token (cart, checkout, orders, account)
      const setAuthHeader = (authenticated) => {
        const token = authenticated && getUserToken();
        if (token) CORE_FETCH_GRAPHQL.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
        else CORE_FETCH_GRAPHQL.removeFetchGraphQlHeader('Authorization');
      };
      setAuthHeader(isAuthenticated());
      const { events } = await import('@dropins/tools/event-bus.js');
      events.on('authenticated', setAuthHeader);
    })();
  }
  return ready;
}

const labels = (key) => import('./commerce-labels.js').then((m) => m[key]);

/** Initializes a drop-in once: shared GraphQL client + pt-BR labels (+ options). */
const dropins = {};
function initializeDropin(name, loadApi, labelsKey, options = {}) {
  if (!dropins[name]) {
    dropins[name] = (async () => {
      await initializeCommerce();
      const [{ initialize, setEndpoint }, dictionary] = await Promise.all([
        loadApi(), labels(labelsKey),
      ]);
      setEndpoint(CORE_FETCH_GRAPHQL);
      await initializers.mountImmediately(initialize, {
        langDefinitions: { default: dictionary },
        ...options,
      });
    })();
  }
  return dropins[name];
}

/** Auth drop-in (sign in, sign up, password) — validates the session of a signed-in customer. */
export const initializeAuth = () => initializeDropin('auth', () => import('@dropins/storefront-auth/api.js'), 'AUTH_LABELS');
/** Account drop-in (customer details, orders list). */
export const initializeAccount = () => initializeDropin('account', () => import('@dropins/storefront-account/api.js'), 'ACCOUNT_LABELS');
/** Checkout drop-in (billing address, payment, place order). */
export const initializeCheckout = () => initializeDropin('checkout', () => import('@dropins/storefront-checkout/api.js'), 'CHECKOUT_LABELS');

/** Cart drop-in (customer cart), after the auth drop-in so the customer cart is used. */
export async function initializeCart() {
  if (isAuthenticated()) await initializeAuth();
  return initializeDropin('cart', () => import('@dropins/storefront-cart/api.js'), 'CART_LABELS');
}

/**
 * Order drop-in for one order: a signed-in customer's order number (orderRef) or the data of
 * an order just placed (orderData). Without either, it only listens to the order placed.
 */
export async function initializeOrder({ orderRef, orderData } = {}) {
  await initializeCommerce();
  const [{ initialize, setEndpoint }, dictionary] = await Promise.all([
    import('@dropins/storefront-order/api.js'),
    labels('ORDER_LABELS'),
  ]);
  setEndpoint(CORE_FETCH_GRAPHQL);
  await initializers.mountImmediately(initialize, {
    langDefinitions: { default: dictionary },
    ...(orderData ? { orderData } : { orderRef }),
  });
}

/** Signs the customer out (revokes the token) and goes to the given page. */
export async function signOut(destination = sitePath('/')) {
  try {
    await initializeAuth();
    const { revokeCustomerToken } = await import('@dropins/storefront-auth/api.js');
    await revokeCustomerToken();
  } finally {
    window.location.href = destination;
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Cart                                                                                      */
/* ---------------------------------------------------------------------------------------- */

/** Current cart, once the cart drop-in loaded it (customer cart). */
async function getCurrentCart() {
  await initializeCart();
  const { events } = await import('@dropins/tools/event-bus.js');
  const initialized = await new Promise((resolve) => {
    const sub = events.on('cart/initialized', (cart) => {
      setTimeout(() => sub?.off());
      resolve(cart);
    }, { eager: true });
  });
  // later changes (items added / removed) come in cart/data
  return events.lastPayload('cart/data') ?? initialized;
}

/**
 * The cart holds one plan only: removes every other item and leaves `sku` with quantity 1.
 * Rejects when the product can't be added (unknown SKU, out of stock...). Calls are queued.
 */
let cartQueue = Promise.resolve();
export function replaceCartWith(sku) {
  const run = async () => {
    const cart = await getCurrentCart();
    const {
      addProductsToCart, updateProductsFromCart,
    } = await import('@dropins/storefront-cart/api.js');
    const items = cart?.items || [];
    const same = (item) => [item.sku, item.topLevelSku]
      .some((s) => s?.toLowerCase() === sku.toLowerCase());
    const keep = items.find(same);
    const changes = items
      .filter((item) => item !== keep)
      .map((item) => ({ uid: item.uid, quantity: 0 }));
    if (keep && keep.quantity !== 1) changes.push({ uid: keep.uid, quantity: 1 });
    if (changes.length) await updateProductsFromCart(changes);
    if (!keep) await addProductsToCart([{ sku, quantity: 1 }]);
  };
  const result = cartQueue.then(run);
  cartQueue = result.catch(() => {});
  return result;
}
