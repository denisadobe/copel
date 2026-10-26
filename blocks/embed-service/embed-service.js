/*
 * Embed (service)
 *
 * Renders a generic iframe for an external https service/app.
 *   row 1: link to the service (link text becomes the iframe title).
 *          A bare https URL typed as text is accepted too.
 *   row 2 (optional): height, e.g. "850px", "850", "80vh". Default 800px.
 *
 * The iframe is created lazily when the block nears the viewport.
 * A fallback link "Abrir em nova aba" is always rendered, because some
 * services refuse framing (X-Frame-Options / frame-ancestors) and the
 * browser gives no reliable signal for that.
 *
 * Universal Editor: a vh height is turned into px (the editor sizes its iframe to the page,
 * so a vh-based height would keep growing).
 */
import { IS_UE, claimDecoration } from '../../scripts/ue-utils.js';

const DEFAULT_HEIGHT = '800px';
const HEIGHT_RE = /^(\d{2,4}(?:\.\d+)?)\s*(px|vh|rem|em)?$/i;
const URL_RE = /https:\/\/[^\s"'<>]+/i;

function parseUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), window.location.href);
    return url.protocol === 'https:' ? url : null;
  } catch (e) {
    return null;
  }
}

// reference viewport height for vh values in the editor
const UE_VIEWPORT_PX = 900;

function parseHeight(text) {
  const match = (text || '').trim().match(HEIGHT_RE);
  if (!match) return null;
  const unit = (match[2] || 'px').toLowerCase();
  if (IS_UE && unit === 'vh') return `${Math.round((parseFloat(match[1]) * UE_VIEWPORT_PX) / 100)}px`;
  return `${match[1]}${unit}`;
}

function findSource(block) {
  const links = [...block.querySelectorAll('a[href]')];
  const link = links.find((a) => parseUrl(a.getAttribute('href')));
  if (link) {
    const url = parseUrl(link.getAttribute('href'));
    const text = link.textContent.trim();
    const title = text && !URL_RE.test(text) ? text : (link.title || url.hostname);
    return { url, title };
  }
  const match = block.textContent.match(URL_RE);
  const url = match ? parseUrl(match[0]) : null;
  return url ? { url, title: url.hostname } : null;
}

function findHeight(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const found = cells
    .filter((cell) => !cell.querySelector('a'))
    .map((cell) => parseHeight(cell.textContent))
    .find(Boolean);
  return found || DEFAULT_HEIGHT;
}

function buildIframe(url, title) {
  const iframe = document.createElement('iframe');
  iframe.src = url.href;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('allow', 'geolocation; clipboard-write; fullscreen');
  iframe.setAttribute('allowfullscreen', '');
  return iframe;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const source = findSource(block);
  const height = findHeight(block);

  if (!source) {
    // nothing usable authored: leave content visible but mark the block
    block.classList.add('embed-service-empty');
    return;
  }

  const { url, title } = source;

  const frame = document.createElement('div');
  frame.className = 'embed-service-frame';
  frame.style.setProperty('--embed-service-height', height);

  const fallback = document.createElement('p');
  fallback.className = 'embed-service-fallback';
  const fallbackLink = document.createElement('a');
  fallbackLink.href = url.href;
  fallbackLink.target = '_blank';
  fallbackLink.rel = 'noopener noreferrer';
  fallbackLink.textContent = 'Abrir em nova aba';
  fallbackLink.setAttribute('aria-label', `${title} - Abrir em nova aba`);
  fallback.append(fallbackLink);

  block.replaceChildren(frame, fallback);

  const load = () => {
    if (frame.querySelector('iframe')) return;
    const iframe = buildIframe(url, title);
    iframe.addEventListener('load', () => frame.classList.add('embed-service-loaded'), { once: true });
    frame.append(iframe);
  };

  if (!('IntersectionObserver' in window)) {
    load();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      load();
    }
  }, { rootMargin: '300px 0px' });
  observer.observe(block);
}
