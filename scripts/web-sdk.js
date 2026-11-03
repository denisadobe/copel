/*
 * Adobe Web SDK (alloy), one instance per page, for Brand Concierge (Adobe Target runs on
 * at.js, see head.html). Nothing is downloaded until loadWebSdk() is called (the chat is
 * opened). Configuration: scripts/brand-concierge-config.js.
 */
import { loadScript } from './aem.js';
import {
  ALLOY_CONFIG, ALLOY_SRC, isConfigured,
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
