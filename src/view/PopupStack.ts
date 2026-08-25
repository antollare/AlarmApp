import { el } from './dom.js';

/**
 * The pop ups the design doc asks for. A trip with several contacts produces
 * several at once, so they stack rather than blocking one at a time.
 */
export class PopupStack {
  private readonly root = el('div', { class: 'popup-stack', role: 'status', 'aria-live': 'polite' });
  private readonly cards = el('div', { class: 'popup-cards' });
  private readonly dismissAll = el('button', { class: 'ghost dismiss-all', type: 'button' }, 'Dismiss all');

  constructor(host: HTMLElement) {
    this.dismissAll.addEventListener('click', () => this.clear());
    this.root.append(this.dismissAll, this.cards);
    host.append(this.root);
    this.sync();
  }

  push(title: string, body: string, tone: 'alert' | 'info' = 'info'): void {
    const close = el('button', { class: 'popup-close', type: 'button', 'aria-label': 'Dismiss' }, '×');
    const card = el(
      'div',
      { class: `popup popup-${tone}` },
      el('div', { class: 'popup-title' }, title),
      el('p', { class: 'popup-body' }, body),
      close,
    );
    close.addEventListener('click', () => {
      card.remove();
      this.sync();
    });
    this.cards.append(card);
    this.sync();
  }

  clear(): void {
    this.cards.replaceChildren();
    this.sync();
  }

  private sync(): void {
    const count = this.cards.childElementCount;
    this.root.classList.toggle('is-empty', count === 0);
    this.dismissAll.hidden = count < 2;
  }
}
