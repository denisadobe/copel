/*
 * Promo strip: an empty slot filled by Adobe Target (at.js, VEC activity "Copel | Site | Promo
 * por jornada"). The block is always empty on the page (authored rows are dropped) and gets the
 * id the VEC activity targets, #promo-strip: do not rename it. Empty = no strip (CSS :empty).
 *
 * Signed-in visitors always get a strip (both experiences of the activity have one), so its
 * space is held from the first render (class promo-strip-expected); if no offer arrives the
 * space is released. The offer markup brings its own inline styles; the CSS only fades it in.
 *
 * Universal Editor (IS_UE): an editor-only placeholder shows where the strip goes.
 */
import { isAuthenticated } from '../../scripts/commerce-session.js';
import { IS_UE, claimDecoration } from '../../scripts/ue-utils.js';

const PROMO_STRIP_ID = 'promo-strip';
// no offer by then (Target down, no activity): give the held space back
const RELEASE_AFTER_MS = 6000;

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  if (IS_UE) {
    block.classList.add('promo-strip-editor');
    return;
  }
  block.replaceChildren();
  // one slot per page: Target fills the first one
  if (!document.getElementById(PROMO_STRIP_ID)) block.id = PROMO_STRIP_ID;
  block.setAttribute('aria-live', 'polite');
  if (isAuthenticated()) {
    block.classList.add('promo-strip-expected');
    setTimeout(() => {
      if (!block.childNodes.length) block.classList.remove('promo-strip-expected');
    }, RELEASE_AFTER_MS);
  }
}
