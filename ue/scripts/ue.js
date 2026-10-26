/*
 * Universal Editor (Author Bus) behaviors. Loaded by scripts/scripts.js only in the editor
 * (*.ue.da.live, see IS_UE in scripts/ue-utils.js), before the page decorates.
 * Blocks keep their own instrumentation (moveInstrumentation in scripts/ue-utils.js); this file
 * makes interactive blocks react to what the author selects in the editor. After an edit the
 * editor reloads the page, so every block decorates once from fresh content.
 *
 * Blocks are reached through DOM events (no block module imports):
 *   carousel-hero        listens to "carousel-hero:show" { detail: { index } }
 *   accordion-faq        <details> items are opened directly
 *   carousel-coverage / carousel-quicklinks   the selected item is scrolled into view
 */

const setupUEEventHandlers = () => {
  // when an image is swapped in the editor, drop stale responsive sources
  document.body.addEventListener('aue:content-patch', ({ detail: { patch, request } }) => {
    let element = document.querySelector(`[data-aue-resource="${request.target.resource}"]`);
    if (element && element.getAttribute('data-aue-prop') !== patch.name) element = element.querySelector(`[data-aue-prop='${patch.name}']`);
    if (element?.getAttribute('data-aue-type') !== 'media') return;

    const picture = element.tagName === 'IMG' ? element.closest('picture') : element;
    picture?.querySelectorAll('source').forEach((source) => source.remove());
    picture?.querySelector('img')?.removeAttribute('srcset');
  });

  // bring the selected item into view inside carousels and accordions
  document.body.addEventListener('aue:ui-select', ({ detail }) => {
    const resource = detail?.resource;
    if (!resource) return;
    const element = document.querySelector(`[data-aue-resource="${resource}"]`);
    if (!element) return;
    const blockEl = element.closest('.block');
    if (!blockEl) return;

    if (blockEl.classList.contains('carousel-hero')) {
      const slide = element.closest('.carousel-hero-slide');
      if (slide) {
        blockEl.dispatchEvent(new CustomEvent('carousel-hero:show', {
          detail: { index: parseInt(slide.dataset.slideIndex, 10) },
        }));
      }
    } else if (blockEl.classList.contains('accordion-faq')) {
      element.closest('details')?.setAttribute('open', '');
    } else if (blockEl.classList.contains('carousel-coverage') || blockEl.classList.contains('carousel-quicklinks')) {
      element.closest('li')?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
    }
  });
};

export default () => {
  setupUEEventHandlers();
};
