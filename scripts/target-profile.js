/*
 * What Adobe Target is told about the visitor, read from Commerce (the source of truth) instead
 * of a Target profile: no identity stitching needed, and the app can send the same values for
 * the same signed-in customer. Sent as mbox parameters (Web SDK data.__adobe.target):
 *   logado               "true" / "false"
 *   clienteProtegeCasa   "true" when the signed-in customer has a Seguro Protege Casa order
 *   canal                "site"
 * The purchase state is kept in localStorage for the signed-in customer (per token, so every tab
 * and the next pages use it right away): set when an order is placed (markProtegeCasaCustomer,
 * checkout confirmation), else from one GraphQL orders request; head.html reads the same entry
 * for the at.js page-load request and refreshProtegeCasaCustomer() corrects it in the background.
 */
import { getStorefrontConfig, getUserToken } from './commerce-session.js';

// also read by the inline at.js setup in head.html (same key and shape)
const CACHE_KEY = 'copel-target-profile';
const REFRESHED_KEY = 'copel-target-profile-refreshed';
const ORDERS_TIMEOUT_MS = 3000;
const PROTEGE_CASA_SKU = /^protege-casa/i;
const ORDERS_QUERY = 'query COPEL_TARGET_ORDERS { customer { orders(pageSize: 50) { items { items { product_sku } } } } }';

// the cache belongs to one sign-in: a different token (other customer) checks again
const tokenKey = (token) => token.slice(-16);

function readCache(token) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached?.token === tokenKey(token) ? cached : null;
  } catch (e) {
    return null;
  }
}

function writeCache(token, clienteProtegeCasa) {
  try {
    const entry = { token: tokenKey(token), clienteProtegeCasa };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    // storage unavailable: checked again on the next page
  }
}

async function hasProtegeCasaOrder(token) {
  const values = (await getStorefrontConfig())?.public?.default || {};
  const endpoint = values['commerce-core-endpoint'] || values['commerce-endpoint'];
  if (!endpoint) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORDERS_TIMEOUT_MS);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(values.headers?.all || {}),
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: ORDERS_QUERY }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`orders ${resp.status}`);
    const json = await resp.json();
    if (!json?.data?.customer) throw new Error('no customer');
    const orders = json.data.customer.orders?.items || [];
    return orders.some((order) => (order?.items || [])
      .some((item) => PROTEGE_CASA_SKU.test(item?.product_sku || '')));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{logado: string, clienteProtegeCasa: string, canal: string}>} mbox
 *   parameters (strings, as Target audiences compare them)
 */
export async function getTargetParams() {
  const token = getUserToken();
  const params = { logado: String(!!token), clienteProtegeCasa: 'false', canal: 'site' };
  if (!token) return params;
  let cached = readCache(token);
  if (!cached) {
    try {
      const clienteProtegeCasa = await hasProtegeCasaOrder(token);
      writeCache(token, clienteProtegeCasa);
      cached = { clienteProtegeCasa };
    } catch (e) {
      // Commerce unavailable / token expired: decide as a customer without the insurance
      cached = { clienteProtegeCasa: false };
    }
  }
  params.clienteProtegeCasa = String(!!cached.clienteProtegeCasa);
  return params;
}

/** Checkout confirmation: the customer now has the insurance (no need to ask Commerce). */
export function markProtegeCasaCustomer() {
  const token = getUserToken();
  if (token) writeCache(token, true);
}

/* ---------------------------------------------------------------------------------------- */
/* at.js profile parameters (activity "Copel | Site | Promo por jornada")                    */
/* ---------------------------------------------------------------------------------------- */

/**
 * Profile attributes the at.js audiences read ("Copel | Logado": copel_logado, "Copel | Comprou
 * seguro": copel_comprou_seguro), from Commerce instead of the visited URL:
 *   copel_logado          "true" / "false": the Commerce sign-in of this page view
 *   copel_comprou_seguro  "true" / "false" once known for the signed-in customer (Protege Casa
 *                         order); "false" when signed out; left out while not checked yet
 * @returns {Object<string, string>} attribute -> value (no "profile." prefix)
 */
export function getAtjsProfile() {
  const token = getUserToken();
  if (!token) return { copel_logado: 'false', copel_comprou_seguro: 'false' };
  const cached = readCache(token);
  return cached
    ? { copel_logado: 'true', copel_comprou_seguro: String(!!cached.clienteProtegeCasa) }
    : { copel_logado: 'true' };
}

/**
 * Signed-in customer with no stored purchase state yet: checks the orders (one Commerce request,
 * stored for the next pages).
 * @returns {Promise<void>}
 */
export async function checkProtegeCasaCustomer() {
  const token = getUserToken();
  if (token && !readCache(token)) await getTargetParams();
}

/**
 * Background correction of a stored purchase state (e.g. an order placed in another channel):
 * once per browser session and sign-in, never before the Target request.
 * @returns {Promise<void>}
 */
export async function refreshProtegeCasaCustomer() {
  const token = getUserToken();
  if (!token || !readCache(token)) return;
  try {
    if (sessionStorage.getItem(REFRESHED_KEY) === tokenKey(token)) return;
    sessionStorage.setItem(REFRESHED_KEY, tokenKey(token));
  } catch (e) {
    // storage unavailable: refresh anyway
  }
  try {
    writeCache(token, await hasProtegeCasaOrder(token));
  } catch (e) {
    // Commerce unavailable: keep the stored state
  }
}
