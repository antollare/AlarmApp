import type { AlarmController, AlarmState } from '../controller/AlarmController.js';
import type { PopupStack } from './PopupStack.js';
import { el, qs } from './dom.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Tab two: the test alarm. Status, keypad, and the trip/reset buttons.
 *
 * This view holds no alarm logic -- it forwards presses to the controller and
 * turns controller events into pop ups. The countdown shown here is a readout
 * of controller state, not a timer of its own.
 */
export class TestTab {
  readonly element = el('section', { class: 'panel', id: 'panel-test' });

  private readonly statusLabel: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly entryDisplay: HTMLElement;
  private readonly keypad: HTMLElement;
  private readonly tripButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly enterButton: HTMLButtonElement;
  private entry = '';
  private remainingMs = 0;

  constructor(
    private readonly controller: AlarmController,
    private readonly popups: PopupStack,
  ) {
    this.element.innerHTML = `
      <div class="card">
        <header class="card-head">
          <h2>Test alarm</h2>
          <p class="hint">Trip the alarm, then enter a code before the countdown runs out.</p>
        </header>
        <div class="status" data-status>
          <span class="status-dot"></span>
          <span class="status-text" data-status-text>Ready</span>
        </div>
        <div class="keypad-wrap">
          <div class="entry" data-entry aria-live="polite">Enter code</div>
          <div class="keypad" data-keypad></div>
          <div class="keypad-actions">
            <button type="button" class="ghost" data-clear>Clear</button>
            <button type="button" class="primary" data-enter>Enter</button>
          </div>
        </div>
        <div class="alarm-actions">
          <button type="button" class="danger" data-trip>Trip alarm</button>
          <button type="button" class="ghost" data-reset>Reset alarm</button>
        </div>
      </div>
    `;

    this.statusLabel = qs(this.element, '[data-status]');
    this.statusText = qs(this.element, '[data-status-text]');
    this.entryDisplay = qs(this.element, '[data-entry]');
    this.keypad = qs(this.element, '[data-keypad]');
    this.tripButton = qs(this.element, '[data-trip]');
    this.resetButton = qs(this.element, '[data-reset]');
    this.enterButton = qs(this.element, '[data-enter]');

    this.buildKeypad();

    qs<HTMLButtonElement>(this.element, '[data-clear]').addEventListener('click', () => {
      this.entry = '';
      this.renderEntry();
    });
    this.enterButton.addEventListener('click', () => void this.submit());
    this.tripButton.addEventListener('click', () => this.controller.trip());
    this.resetButton.addEventListener('click', () => this.controller.reset());

    controller.on('stateChanged', ({ state }) => {
      this.entry = '';
      this.remainingMs = controller.getRemainingMs();
      this.renderEntry();
      this.renderStatus(state);
    });

    controller.on('countdownTick', ({ remainingMs }) => {
      this.remainingMs = remainingMs;
      this.renderStatus(controller.getState());
    });

    controller.on('alertRaised', () => {
      this.popups.push(
        'Alarm tripped',
        'Contact info for alarm trip is being contacted.',
        'alert',
      );
    });

    controller.on('contactCalled', ({ contact }) => {
      this.popups.push('Contact reached', `${contact.name} has been contacted`);
    });

    controller.on('codeAccepted', ({ assignee }) => {
      this.popups.push('Alarm cleared', `Code accepted. Disarmed by ${assignee}.`);
    });

    this.remainingMs = controller.getRemainingMs();
    this.renderStatus(controller.getState());
    this.renderEntry();
  }

  private buildKeypad(): void {
    this.keypad.replaceChildren(
      ...KEYS.map((key) => {
        const button = el('button', { type: 'button', class: 'key' }, key);
        button.addEventListener('click', () => {
          if (this.entry.length >= 10) return;
          this.entry += key;
          this.renderEntry();
        });
        return button;
      }),
    );
  }

  private async submit(): Promise<void> {
    const result = await this.controller.submitCode(this.entry);
    if (result.outcome === 'ignored') {
      this.popups.push('Nothing to disarm', 'The alarm is not tripped.');
    }
    // An empty entry is deliberately silent: the countdown decides.
    this.entry = '';
    this.renderEntry();
  }

  private renderEntry(): void {
    this.entryDisplay.textContent = this.entry.length === 0 ? 'Enter code' : '•'.repeat(this.entry.length);
    this.entryDisplay.classList.toggle('is-empty', this.entry.length === 0);
  }

  private renderStatus(state: AlarmState): void {
    const tripped = state === 'tripped';
    this.statusLabel.classList.toggle('is-tripped', tripped);
    this.statusText.textContent = tripped ? this.trippedLabel() : 'Ready';
    this.tripButton.disabled = tripped;
    this.resetButton.disabled = !tripped;
  }

  private trippedLabel(): string {
    if (this.remainingMs <= 0) return 'TRIPPED — contacts called';
    return `TRIPPED — ${Math.ceil(this.remainingMs / 1000)}s remaining`;
  }
}
