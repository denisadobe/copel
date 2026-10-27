/*
 * Universal Editor (UE) helpers shared by blocks. Everything here is a no-op outside the editor,
 * where the data-aue-* / data-richtext-* instrumentation attributes are absent.
 */

/**
 * True when the page is rendered for the Universal Editor on Author Bus (DA): served from
 * *.ue.da.live (or *.stage-ue.da.live), or carrying the UE connection meta that
 * .ue.da.live injects into the head.
 */
export const IS_UE = /\.(stage-ue|ue)\.da\.live$/.test(window.location.hostname)
  || !!document.querySelector('meta[name="urn:adobe:aue:system:ab"]');

/**
 * Moves the given attributes (default: all) from one element to another.
 * @param {Element} from the element to move attributes from
 * @param {Element} to the element to move attributes to
 * @param {string[]} [attributes] attribute names to move
 */
export function moveAttributes(from, to, attributes) {
  if (!from || !to) return;
  const names = attributes || [...from.attributes].map(({ nodeName }) => nodeName);
  names.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Moves Universal Editor instrumentation (data-aue-*, data-richtext-*) between elements,
 * so blocks that rebuild their DOM stay selectable and editable in the editor.
 * @param {Element} from the element to move instrumentation from
 * @param {Element} to the element to move instrumentation to
 */
export function moveInstrumentation(from, to) {
  if (!from || !to || from === to) return;
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * Replaces a picture with an optimized copy, keeping the instrumentation of the picture
 * (image component) and of its img (media field), and the intrinsic width/height of the
 * authored img (createOptimizedPicture drops them), so the browser reserves the image's
 * aspect ratio before it loads (no layout shift).
 * @param {Element} picture the authored picture
 * @param {Element} optimized the new picture (from createOptimizedPicture)
 * @returns {Element} the new picture
 */
export function replacePicture(picture, optimized) {
  const img = picture.querySelector('img');
  const optimizedImg = optimized.querySelector('img');
  moveInstrumentation(picture, optimized);
  moveInstrumentation(img, optimizedImg);
  if (img && optimizedImg) {
    ['width', 'height'].forEach((attr) => {
      if (img.hasAttribute(attr) && !optimizedImg.hasAttribute(attr)) {
        optimizedImg.setAttribute(attr, img.getAttribute(attr));
      }
    });
  }
  picture.replaceWith(optimized);
  return optimized;
}

/**
 * Whether an authored row should be skipped as empty. In the editor, empty rows are kept:
 * a block item the author has just added has no content yet and must stay selectable.
 * @param {Element} row block row
 * @param {string} [media] selector of media that counts as content
 */
export function isEmptyRow(row, media = 'picture, img, span.icon') {
  if (IS_UE && row.hasAttribute('data-aue-resource')) return false;
  return !row.textContent.trim() && !row.querySelector(media);
}

/**
 * Inside a Universal Editor column cell, text content is wrapped in an instrumented
 * div.richtext (one editable "Text" component). Returns that wrapper when it holds all of the
 * cell's flow content, so blocks can decorate inside it without breaking the editable;
 * otherwise returns the cell itself.
 * @param {Element} cell block cell
 */
export function contentRoot(cell) {
  const children = [...cell.children];
  if (children.length === 1 && children[0].matches('div.richtext, div[data-aue-type="richtext"]')) {
    return children[0];
  }
  return cell;
}

/**
 * Guards a block against a second decoration of the same element (editor re-renders),
 * which would otherwise duplicate controls. Returns false when the block was already decorated.
 * @param {Element} block the block element
 */
export function claimDecoration(block) {
  if (block.dataset.decorated === 'true') return false;
  block.dataset.decorated = 'true';
  return true;
}

/**
 * Editor only: in an item without media yet (e.g. just added), the first, empty cell is the
 * media slot, so the item keeps its [media | text] layout and the text cell its editable.
 * @param {Element[]} cells the item's cells
 * @returns {Element|undefined} the media cell, or undefined outside the editor
 */
export function emptyMediaSlot(cells) {
  return IS_UE && cells.length > 1 && !cells[0].textContent.trim() ? cells[0] : undefined;
}

/**
 * Editor only: replaces a block that needs a signed-in shopper (Commerce drop-ins) with a short
 * note, so the editor never redirects to the login page or calls Commerce.
 * @param {Element} block the block element
 * @param {string} text what the block shows on the site
 */
export function showEditorPlaceholder(block, text) {
  const note = document.createElement('p');
  note.className = `${block.dataset.blockName || block.classList[0]}-message ue-placeholder`;
  note.textContent = text;
  block.replaceChildren(note);
}
