/*
 * Library Metadata
 * Describes a block sample for the Document Authoring block library.
 * It carries no visible content, so it is hidden when a sample is rendered on a page.
 */
export default function decorate(block) {
  block.setAttribute('aria-hidden', 'true');
}
