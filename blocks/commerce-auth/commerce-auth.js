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
import { IS_UE } from '../../scripts/ue-utils.js';

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

// the drop-in inputs report their value on 'change' (blur), debounced by 200 ms
const COMMIT_DELAY = 250;
const TEXT_FIELDS = 'input:not([type="checkbox"], [type="radio"], [type="hidden"], [type="submit"], [type="button"]), textarea, select';

/**
 * The drop-in forms validate and submit from field state that only updates on 'change'
 * (blur) + 200 ms: typing the password and pressing Enter, or clicking the button while still
 * in the field, submitted stale (empty) values and nothing happened. Each submit is held once:
 * the fields commit their values ('change'), then the form is submitted again once the
 * drop-in state caught up. The drop-in code is untouched.
 * @param {Element} container element the drop-in form renders into
 */
function commitFieldsOnSubmit(container) {
  const pending = new WeakSet();
  const released = new WeakSet();
  container.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || released.has(form)) return;
    // capture phase on an ancestor: the drop-in's own submit handler does not run now
    e.preventDefault();
    e.stopPropagation();
    if (pending.has(form)) return;
    pending.add(form);
    form.querySelectorAll(TEXT_FIELDS).forEach((field) => {
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const submitter = e.submitter?.form === form ? e.submitter : null;
    setTimeout(() => requestAnimationFrame(() => {
      pending.delete(form);
      if (!form.isConnected) return;
      released.add(form);
      try {
        if (submitter) form.requestSubmit(submitter); else form.requestSubmit();
      } finally {
        released.delete(form);
      }
    }), COMMIT_DELAY);
  }, true);
}

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
  commitFieldsOnSubmit(container);
  if (IS_UE) {
    // editor: keep the (instrumented) key-value rows, hidden, and never redirect
    const source = document.createElement('div');
    source.className = 'commerce-auth-source';
    source.hidden = true;
    source.append(...block.children);
    block.replaceChildren(container, source);
  } else {
    block.replaceChildren(container);
  }

  // already signed in: nothing to do here
  if (isAuthenticated() && form !== 'update-password' && !IS_UE) {
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
