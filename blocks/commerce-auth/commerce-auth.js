/*
 * Customer sign in / sign up / password forms (Adobe Commerce auth drop-in).
 * Authoring (key-value table, all optional):
 *   form     | sign-in (default), sign-up, forgot-password or update-password
 *   redirect | page after sign in (default /loja/conta; a ?redirect= on the URL wins)
 * ?sku= on the URL (plan chosen before signing in) goes along to the page after sign in, which
 * resumes the purchase (scripts/commerce-plans.js). update-password is the page of the
 * "reset password" e-mail link (?email=&key=).
 */
import { readBlockConfig } from '../../scripts/aem.js';
import {
  ACCOUNT_PAGE, FORGOT_PASSWORD_PAGE, LOGIN_PAGE, SIGNUP_PAGE,
  getRedirect, initializeAuth, isAuthenticated, isValidSku, loadCommerceStyles,
  redirectTo,
} from '../../scripts/commerce.js';
import { RESUME_PARAM } from '../../scripts/commerce-plans.js';

const FORMS = {
  'sign-in': ['SignIn', ({ next, keep }) => ({
    routeForgotPassword: () => keep(FORGOT_PASSWORD_PAGE),
    routeSignUp: () => keep(SIGNUP_PAGE),
    renderSignUpLink: true,
    routeRedirectOnSignIn: () => next,
  })],
  'sign-up': ['SignUp', ({ next, keep }) => ({
    hideCloseBtnOnEmailConfirmation: true,
    routeSignIn: () => keep(LOGIN_PAGE),
    routeRedirectOnSignIn: () => next,
    routeRedirectOnEmailConfirmationClose: () => keep(LOGIN_PAGE),
  })],
  'forgot-password': ['ResetPassword', ({ keep }) => ({
    routeSignIn: () => keep(LOGIN_PAGE),
  })],
  'update-password': ['UpdatePassword', () => ({
    routeWrongUrlRedirect: () => FORGOT_PASSWORD_PAGE,
    routeSignInPage: () => LOGIN_PAGE,
  })],
};

/** Adds the chosen plan to the page after sign in: /seguro-protege-casa?contratar=sku#planos */
function withPlan(path, sku) {
  if (!sku) return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set(RESUME_PARAM, sku);
  return url.pathname + url.search + url.hash;
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const form = FORMS[config.form] ? config.form : 'sign-in';
  const params = new URLSearchParams(window.location.search);
  const sku = isValidSku(params.get('sku')) ? params.get('sku') : '';
  const next = withPlan(getRedirect(config.redirect || ACCOUNT_PAGE), sku);
  // links between the forms keep ?redirect= and ?sku=
  const keep = (page) => {
    const kept = new URLSearchParams();
    ['redirect', 'sku'].forEach((key) => params.get(key) && kept.set(key, params.get(key)));
    return kept.toString() ? `${page}?${kept}` : page;
  };

  const container = document.createElement('div');
  container.className = 'commerce-auth-form';
  block.replaceChildren(container);

  // already signed in: nothing to do here
  if (isAuthenticated() && form !== 'update-password') {
    await redirectTo(next);
    return;
  }

  loadCommerceStyles();
  try {
    await initializeAuth();
    const [name, props] = FORMS[form];
    const [{ render }, { default: Container }] = await Promise.all([
      import('@dropins/storefront-auth/render.js'),
      import(`@dropins/storefront-auth/containers/${name}.js`),
    ]);
    await render.render(Container, props({ next, keep }))(container);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('commerce-auth:', error);
    const p = document.createElement('p');
    p.className = 'commerce-auth-message';
    p.setAttribute('role', 'alert');
    p.textContent = 'Não foi possível carregar o formulário no momento. Tente novamente mais tarde.';
    container.replaceChildren(p);
  }
}
