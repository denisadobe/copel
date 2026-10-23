/* eslint-disable */
/* global WebImporter */

/**
 * Copel section transformer.
 * Driven entirely by payload.template.sections so it works for any template.
 * - beforeTransform: insert <hr> section breaks (while source elements still exist)
 *   and mark breaks of styled sections with a temporary data-excat-section-id.
 * - afterTransform: insert Section Metadata (style) after each marker <hr>.
 */

const MARKER = 'data-excat-section-id';

function findSectionElement(root, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (let i = 0; i < selectors.length; i += 1) {
    const sel = selectors[i];
    if (!sel) continue;
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector, try the next one
    }
  }
  return null;
}

function hasStyle(section) {
  return typeof section.style === 'string' && section.style.trim() !== '';
}

export default function transform(hookName, element, payload) {
  const { document, template } = payload || {};
  const sections = template && Array.isArray(template.sections) ? template.sections : [];
  if (sections.length < 2) return;
  const doc = document || element.ownerDocument;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSectionElement(element, section);
      if (!el || !el.parentNode) continue;
      const styled = hasStyle(section);
      // Non-first sections always get a break; a styled first section gets a temporary one.
      if (i > 0 || styled) {
        const hr = doc.createElement('hr');
        if (styled) hr.setAttribute(MARKER, section.id);
        if (i === 0) hr.setAttribute('data-excat-first', 'true');
        el.parentNode.insertBefore(hr, el);
      }
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!hasStyle(section)) continue;
      const marker = element.querySelector(`hr[${MARKER}="${section.id}"]`);
      const anchor = marker || findSectionElement(element, section);
      if (!anchor || !anchor.parentNode) continue;

      const metadata = WebImporter.Blocks.createBlock(doc, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      anchor.parentNode.insertBefore(metadata, anchor.nextSibling);

      if (marker) {
        if (marker.getAttribute('data-excat-first') === 'true') {
          marker.remove();
        } else {
          marker.removeAttribute(MARKER);
        }
      }
    }
    // Safety: drop any leftover temporary first-section breaks.
    element.querySelectorAll('hr[data-excat-first]').forEach((hr) => hr.remove());
  }
}
