/*
 * Adobe Brand Concierge: environment + Web Client styling configuration.
 *
 * Values from the Copel Brand Concierge install script (Deploy > Component install); styling in
 * brand-concierge-style.json is the Copel styling export. If ALLOY_CONFIG.datastreamId or
 * ALLOY_CONFIG.orgId is emptied the integration becomes INERT: no launcher is rendered, nothing
 * from Adobe is downloaded and the brand-concierge block shows "O assistente virtual estará
 * disponível em breve.".
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
  edgeDomain: 'edge.adobedc.net',
  edgeBasePath: 'ee',
  // shared with the Sebrae demo datastream (client decision for the demo)
  datastreamId: 'c34abba2-b513-4c27-8e6b-d477771eade9',
  orgId: '0E061E2D61F93F260A495FD6@AdobeOrg',
  debugEnabled: false,
  idMigrationEnabled: false,
  thirdPartyCookiesEnabled: false,
  prehidingStyle: '.personalization-container { opacity: 0 !important }',
  conversation: { region: 'va7' },
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
    // the styling export leaves this icon empty, which the Web Client rejects ("Invalid SVG")
    input: {
      showAiChatIcon: {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="#f5821e" aria-hidden="true"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>',
      },
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
