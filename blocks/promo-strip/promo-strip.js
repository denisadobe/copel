/*
 * Promo strip: an empty slot filled by Adobe Target (at.js, VEC activity "Copel | Site | Promo
 * por jornada"). The block is always empty on the page (authored rows are dropped) and gets the
 * id the VEC activity targets, #promo-strip: do not rename it. Empty = no strip (CSS :empty).
 *
 * Markup injected by Target (styled by promo-strip.css):
 *   <div class="promo-strip__inner">
 *     <strong>title</strong> <span>text</span> <a class="promo-strip__cta" href="…">button</a>
 *   </div>
 *
 * Universal Editor (IS_UE): an editor-only placeholder shows where the strip goes.
 */
import { IS_UE, claimDecoration } from '../../scripts/ue-utils.js';

const PROMO_STRIP_ID = 'promo-strip';

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
}
