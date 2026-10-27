/*
 * Adobe Brand Concierge: environment + Web Client styling configuration.
 *
 * >>> COPEL: VALUES PENDING <<<
 * The environment values below are EMPTY PLACEHOLDERS. While ALLOY_CONFIG.datastreamId or
 * ALLOY_CONFIG.orgId is empty the integration is INERT: no launcher is rendered, nothing from
 * Adobe is downloaded and the brand-concierge block shows "O assistente virtual estará
 * disponível em breve.".
 * To switch it on, copy the values from the install script generated in Brand Concierge
 * (Deploy > Component install) into the keys marked "COPEL: fill in".
 *
 * UI test without real config (local preview / *.aem.page only): add ?concierge=preview to the
 * URL — the launcher, drawer and full-page block render with a local stub, no Adobe scripts.
 */

// Web SDK (alloy) and Web Client script URLs, from the install script (Deploy > Component install).
// Generic Adobe CDN URLs: keep them unless the Copel install script shows different ones.
export const ALLOY_SRC = 'https://cdn1.adoberesources.net/alloy/2.35.1/alloy.min.js';
export const WEB_CLIENT_SRC = 'https://experience.adobe.net/solutions/experience-platform-brand-concierge-web-agent/static-assets/main.js';

// Web SDK configuration (alloy("configure", {...}) in the install script)
export const ALLOY_CONFIG = {
  defaultConsent: 'in',
  edgeDomain: 'edge.adobedc.net', // COPEL: confirm (install script "edgeDomain")
  edgeBasePath: 'ee',
  datastreamId: '', // COPEL: fill in (install script "datastreamId")
  orgId: '', // COPEL: fill in (install script "orgId", ends with @AdobeOrg)
  debugEnabled: false,
  idMigrationEnabled: false,
  thirdPartyCookiesEnabled: false,
  prehidingStyle: '.personalization-container { opacity: 0 !important }',
  conversation: { region: '' }, // COPEL: fill in (install script "conversation.region", e.g. va7)
};

/** True when the environment values needed to load Brand Concierge are present. */
export const isConfigured = () => !!(ALLOY_CONFIG.datastreamId && ALLOY_CONFIG.orgId);

// ?concierge=preview (UI test with a local stub) is honoured only on the local preview and on
// *.aem.page branch previews — never on the production site
const PREVIEW_HOSTS = /^(localhost|127\.0\.0\.1)$|\.aem\.page$/;

/**
 * How the assistant runs on this page: 'preview' (local stub, no Adobe scripts), 'live'
 * (Brand Concierge configured) or '' (inert: not configured).
 * @returns {'preview'|'live'|''}
 */
export function getConciergeMode() {
  const { hostname, search } = window.location;
  if (PREVIEW_HOSTS.test(hostname) && new URLSearchParams(search).get('concierge') === 'preview') return 'preview';
  return isConfigured() ? 'live' : '';
}

// Styling configuration exported from Brand Concierge (scripts/brand-concierge-style.json),
// loaded at runtime; these overrides only replace the template placeholders it still contains.
// COPEL: replace brand-concierge-style.json with the Copel export; the overrides below stay.
export const STYLE_URL = '/scripts/brand-concierge-style.json';

// "Portal da privacidade" link of the site footer (content/footer.plain.html)
const PRIVACY_URL = 'https://www.copel.com/site/institucional/portal-da-privacidade/';

export const STYLE_OVERRIDES = {
  behavior: {
    // keep the conversation when moving from the drawer to the full-page assistant
    chatTranscript: {
      enabled: true, maxSessions: 1, maxMessagesPerSession: 50, cleanupInterval: 24,
    },
    privacyNotice: {
      title: 'Aviso de privacidade',
      text: 'Ao usar este assistente virtual, você concorda que as informações fornecidas na conversa podem ser coletadas, usadas e armazenadas pela Copel e por seus prestadores de serviço, conforme o {Portal da privacidade}. Não compartilhe dados pessoais sensíveis (como informações financeiras ou de saúde).',
      links: [{ text: 'Portal da privacidade', url: PRIVACY_URL }],
    },
  },
  // no "Termos de uso" page on the Copel site footer: no terms link
  disclaimer: {
    text: 'As respostas do assistente virtual são geradas automaticamente e podem conter imprecisões. Para atendimento oficial, use os canais de atendimento da Copel.',
    links: [],
  },
  text: {
    'error.general': 'Desculpe, algo deu errado. Tente novamente.',
  },
  theme: {
    // same typeface as the site (var(--body-font-family); Univers is loaded by styles/fonts.css)
    '--font-family': "'Univers LT 55 Roman', univers-fallback, arial, sans-serif",
    // wider conversation on the full-page assistant (the drawer is limited by its own width)
    '--chat-interface-max-width': '1040px',
  },
};
