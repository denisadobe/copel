/*
 * Commerce customer session for every page (the header), without the drop-ins: the cookies
 * set by the auth drop-in on sign in, the storefront config (/config.json) and a sign out
 * that revokes the token with one GraphQL request. scripts/commerce.js builds on this module;
 * nothing here imports @dropins/*.
 */

/**
 * Site path for the current environment: the local preview serves content under /content/
 * (http://localhost:3000/content/loja/entrar), production serves it from the root.
 */
export const sitePath = (path) => (window.location.pathname.startsWith('/content/') ? `/content${path}` : path);

// Set by the auth drop-in on sign in: auth_dropin_user_token, auth_dropin_firstname and
// auth_dropin_lastname, all with path=/; Max-Age (token lifetime); SameSite=Lax; Secure
// (except on localhost). The drop-in also clears the admin session / website code on sign out.
const AUTH_COOKIE = 'auth_dropin_user_token';
const SESSION_COOKIES = [
  AUTH_COOKIE,
  'auth_dropin_firstname',
  'auth_dropin_lastname',
  'auth_dropin_admin_session',
  'auth_dropin_website_code',
];
// customer cart of the cart drop-in (cleared by the drop-in itself on sign out)
const CART_COOKIE = 'DROPIN__CART__CART-ID';
const CART_STORAGE = {
  local: ['DROPIN__CART__CART__AUTHENTICATED'],
  session: ['DROPIN__CART__CART__DATA', 'DROPIN__CART__SHIPPING__DATA'],
};
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** localStorage key written on sign out, so other tabs update their header (storage event). */
export const SESSION_EVENT_KEY = 'commerce-session-change';

const readCookie = (name) => {
  const value = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
};
export const getUserToken = () => readCookie(AUTH_COOKIE);
export const isAuthenticated = () => !!getUserToken();
export const getCustomerFirstName = () => readCookie('auth_dropin_firstname') || '';

/* ---------------------------------------------------------------------------------------- */
/* Storefront config                                                                         */
/* ---------------------------------------------------------------------------------------- */

const CONFIG_KEY = 'commerce-config';

/** /config.json of the site, cached for 2 hours in sessionStorage (shared with the drop-ins). */
export async function getStorefrontConfig() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CONFIG_KEY));
    if (cached && cached[':expiry'] > Date.now() / 1000) return cached;
  } catch (e) {
    // ignore malformed cache
  }
  const resp = await fetch(`${window.location.origin}/config.json`);
  if (!resp.ok) throw new Error(`Commerce config not found (${resp.status})`);
  const config = await resp.json();
  config[':expiry'] = Math.round(Date.now() / 1000) + 7200;
  try {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    // storage unavailable: no cache
  }
  return config;
}

/* ---------------------------------------------------------------------------------------- */
/* Sign out (no drop-ins)                                                                    */
/* ---------------------------------------------------------------------------------------- */

const REVOKE_TIMEOUT = 5000;
const REVOKE_MUTATION = 'mutation REVOKE_CUSTOMER_TOKEN { revokeCustomerToken { result } }';

/** Revokes the customer token on Commerce. Failures are ignored (the cookies go anyway). */
async function revokeToken(token) {
  try {
    const config = await getStorefrontConfig();
    const values = config?.public?.default || {};
    const endpoint = values['commerce-core-endpoint'] || values['commerce-endpoint'];
    if (!endpoint) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(values.headers?.all || {}),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: REVOKE_MUTATION }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    // offline, timeout, token already expired...: the local session ends anyway
  }
}

/** Clears the session cookies (same path / attributes the drop-in sets) and the customer cart. */
function clearSession() {
  const secure = LOCAL_HOSTS.includes(window.location.hostname) ? '' : ' Secure;';
  SESSION_COOKIES.forEach((name) => {
    document.cookie = `${name}=; path=/; Max-Age=0; SameSite=Lax;${secure}`;
  });
  document.cookie = `${CART_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  try {
    CART_STORAGE.local.forEach((key) => localStorage.removeItem(key));
    CART_STORAGE.session.forEach((key) => sessionStorage.removeItem(key));
    localStorage.setItem(SESSION_EVENT_KEY, String(Date.now()));
  } catch (e) {
    // storage unavailable
  }
}

/** Signs the customer out without the drop-ins: revokes the token, then clears the session. */
export async function endCustomerSession() {
  const token = getUserToken();
  if (token) await revokeToken(token);
  clearSession();
}
