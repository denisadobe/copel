/*
 * Adobe Web SDK (alloy), one instance per page shared by Brand Concierge and Adobe Target.
 * Nothing is downloaded until loadWebSdk() is called (the chat is opened, or a block asks
 * Target for a decision). Configuration: scripts/brand-concierge-config.js (same datastream).
 */
import { loadScript } from './aem.js';
import {
  ALLOY_CONFIG, ALLOY_SRC, TARGET_PROPERTY_TOKEN, isConfigured,
} from './brand-concierge-config.js';

let sdk;

// Web SDK command queue (same as the "alloy" base code of the install script)
function installAlloyStub() {
  if (window.alloy) return;
  // eslint-disable-next-line no-underscore-dangle
  (window.__alloyNS = window.__alloyNS || []).push('alloy');
  const alloy = (...args) => new Promise((resolve, reject) => {
    alloy.q.push([resolve, reject, args]);
  });
  alloy.q = [];
  window.alloy = alloy;
}

/**
 * Loads and configures the Web SDK once.
 * @returns {Promise<Function>} window.alloy; rejects when the datastream is not configured
 */
export default function loadWebSdk() {
  if (!sdk) {
    sdk = (async () => {
      if (!isConfigured()) throw new Error('Web SDK not configured');
      installAlloyStub();
      // commands are queued by the stub until the library is loaded
      window.alloy('configure', ALLOY_CONFIG);
      await loadScript(ALLOY_SRC);
      return window.alloy;
    })();
    sdk.catch(() => {});
  }
  return sdk;
}

/**
 * Asks Adobe Target for the decision of one scope (form-based activity, JSON offer).
 * @param {string} scope decision scope (Target location), e.g. "copel-banner-home"
 * @param {Object<string, string>} [params] mbox parameters (data.__adobe.target)
 * @returns {Promise<Object[]>} the propositions (empty when there is no activity)
 */
export async function requestDecision(scope, params = {}) {
  const alloy = await loadWebSdk();
  const result = await alloy('sendEvent', {
    decisionScopes: [scope],
    renderDecisions: false,
    data: { __adobe: { target: params } },
    // a Target property of its own (the datastream is shared with another demo)
    ...(TARGET_PROPERTY_TOKEN
      ? { edgeConfigOverrides: { com_adobe_target: { propertyToken: TARGET_PROPERTY_TOKEN } } }
      : {}),
  });
  return Array.isArray(result?.propositions) ? result.propositions : [];
}

/**
 * Reports what happened to a proposition, for the Target reports (impressions and clicks).
 * @param {Object} proposition proposition returned by requestDecision()
 * @param {'decisioning.propositionDisplay'|'decisioning.propositionInteract'} eventType
 */
export function notifyProposition(proposition, eventType) {
  if (!proposition || typeof window.alloy !== 'function') return;
  const { id, scope, scopeDetails } = proposition;
  Promise.resolve(window.alloy('sendEvent', {
    // a click usually leaves the page: sent with sendBeacon so it isn't cancelled
    documentUnloading: eventType === 'decisioning.propositionInteract',
    xdm: {
      eventType,
      _experience: { decisioning: { propositions: [{ id, scope, scopeDetails }] } },
    },
  })).catch(() => {});
}
