/*
 * Brand Concierge (full page): mounts the Adobe Brand Concierge chat inline, in a tall panel.
 * Authoring: the block needs no content (put an intro as default content above it).
 * A page with this block does not show the floating launcher.
 * Not configured yet (scripts/brand-concierge-config.js): shows a "coming soon" message.
 * In the Universal Editor: a placeholder (the chat is not loaded in the editor).
 */
import { IS_UE } from '../../scripts/ue-utils.js';

function message(panel, text, modifier) {
  const p = document.createElement('p');
  p.className = 'brand-concierge-message';
  p.textContent = text;
  panel.classList.add(`brand-concierge-${modifier}`);
  panel.append(p);
}

export default async function decorate(block) {
  // authored rows stay in the DOM (hidden) so the block keeps its Universal Editor instrumentation
  const source = document.createElement('div');
  source.className = 'brand-concierge-source';
  source.append(...block.children);
  source.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'brand-concierge-panel';
  block.replaceChildren(panel, source);

  if (IS_UE) {
    message(panel, 'Assistente virtual (Adobe Brand Concierge): o chat é carregado na página publicada.', 'placeholder');
    return;
  }

  const { getConciergeMode } = await import('../../scripts/brand-concierge-config.js');
  if (!getConciergeMode()) {
    message(panel, 'O assistente virtual estará disponível em breve.', 'unavailable');
    return;
  }

  const { mountConcierge } = await import('../../scripts/brand-concierge.js');
  await mountConcierge(panel);

  // continuing a conversation (e.g. opened from the drawer): bring the whole chat into view
  const hasTranscript = Object.keys(localStorage).some((k) => k.startsWith('bc_chat_transcript_'));
  if (hasTranscript) setTimeout(() => block.scrollIntoView({ block: 'start' }), 600);
}
