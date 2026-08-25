import { AlarmCodeStore } from '../model/AlarmCodeStore.js';
import { ContactStore } from '../model/ContactStore.js';
import type { AlarmCode } from '../model/AlarmCode.js';
import type { Contact } from '../model/Contact.js';
import { callEveryone, type NotifyPolicy } from '../model/NotifyPolicy.js';
import { Emitter } from './Emitter.js';
import { systemScheduler, type Scheduler } from './Scheduler.js';

export type AlarmState = 'ready' | 'tripped';

/** Why the contacts were called. */
export type NotifyReason = 'no-code' | 'incorrect-code';

export type SubmitResult =
  /** The alarm is not tripped, or a submission is already in flight. */
  | { outcome: 'ignored' }
  /** Nothing was entered. The countdown decides what happens, not this. */
  | { outcome: 'empty' }
  | { outcome: 'accepted'; assignee: string }
  | { outcome: 'rejected'; reason: 'incorrect-code' };

export type AlarmEvents = {
  stateChanged: { state: AlarmState };
  countdownTick: { remainingMs: number };
  alertRaised: { reason: NotifyReason; contacts: readonly Contact[] };
  contactCalled: { contact: Contact };
  codeAccepted: { assignee: string };
  codesChanged: undefined;
  contactsChanged: undefined;
};

export interface AlarmOptions {
  policy?: NotifyPolicy;
  scheduler?: Scheduler;
  countdownMs?: number;
}

export const DEFAULT_COUNTDOWN_MS = 30_000;
const TICK_MS = 1000;

/**
 * The controller in MVC: owns the alarm state machine and is the only thing
 * the views talk to.
 *
 * It never touches the DOM. "Calling" a contact is an event -- the view is
 * what turns that into a pop up, which is what makes the trip sequence
 * testable with no browser in the room.
 *
 * Tripping starts a countdown. The alarm can therefore reach the point of
 * calling contacts with no user input at all, which is why the timer lives
 * here and not in the keypad view.
 */
export class AlarmController extends Emitter<AlarmEvents> {
  private state: AlarmState = 'ready';
  private busy = false;
  private deadline: number | null = null;
  private timerId: number | null = null;

  private readonly policy: NotifyPolicy;
  private readonly scheduler: Scheduler;
  private readonly countdownMs: number;

  constructor(
    readonly codes: AlarmCodeStore = new AlarmCodeStore(),
    readonly contacts: ContactStore = new ContactStore(),
    options: AlarmOptions = {},
  ) {
    super();
    this.policy = options.policy ?? callEveryone;
    this.scheduler = options.scheduler ?? systemScheduler;
    this.countdownMs = options.countdownMs ?? DEFAULT_COUNTDOWN_MS;
  }

  getState(): AlarmState {
    return this.state;
  }

  /** Milliseconds left on the countdown; 0 once it has expired or been cleared. */
  getRemainingMs(): number {
    if (this.deadline === null) return 0;
    return Math.max(0, this.deadline - this.scheduler.now());
  }

  trip(): void {
    if (this.state === 'tripped') return;
    this.setState('tripped');
    this.startCountdown();
  }

  /**
   * Clears the alarm and cancels the countdown without a code. The design doc
   * specifies reset as a plain button, so it is deliberately unauthenticated --
   * a known non-security, useful for demoing.
   */
  reset(): void {
    if (this.state === 'ready') return;
    this.stopCountdown();
    this.setState('ready');
  }

  /**
   * A wrong code calls the contacts immediately, which also ends the trip; a
   * right one clears the alarm without calling anybody. An empty entry does
   * nothing at all -- running out of time is what counts as "no code entered".
   */
  async submitCode(entered: string): Promise<SubmitResult> {
    if (this.state !== 'tripped' || this.busy) {
      return { outcome: 'ignored' };
    }

    this.busy = true;
    try {
      const value = entered.trim();
      if (value.length === 0) {
        return { outcome: 'empty' };
      }

      const match = await this.codes.verify(value);
      if (!match) {
        this.notifyContacts('incorrect-code');
        return { outcome: 'rejected', reason: 'incorrect-code' };
      }

      this.stopCountdown();
      this.setState('ready');
      this.emit('codeAccepted', { assignee: match.assignee });
      return { outcome: 'accepted', assignee: match.assignee };
    } finally {
      this.busy = false;
    }
  }

  async addCode(code: string, assignee: string): Promise<AlarmCode> {
    const created = await this.codes.add(code, assignee);
    this.emit('codesChanged', undefined);
    return created;
  }

  removeCode(id: string): void {
    if (this.codes.remove(id)) {
      this.emit('codesChanged', undefined);
    }
  }

  addContact(name: string, phone: string, email: string): Contact {
    const created = this.contacts.add(name, phone, email);
    this.emit('contactsChanged', undefined);
    return created;
  }

  removeContact(id: string): void {
    if (this.contacts.remove(id)) {
      this.emit('contactsChanged', undefined);
    }
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.deadline = this.scheduler.now() + this.countdownMs;
    this.emit('countdownTick', { remainingMs: this.countdownMs });
    this.timerId = this.scheduler.setInterval(() => this.onTick(), TICK_MS);
  }

  private onTick(): void {
    if (this.deadline === null) return;

    const remainingMs = this.getRemainingMs();
    this.emit('countdownTick', { remainingMs });

    if (remainingMs <= 0) {
      // Time is up, so nobody entered a code: call the contacts.
      this.notifyContacts('no-code');
    }
  }

  private stopCountdown(): void {
    if (this.timerId !== null) {
      this.scheduler.clearInterval(this.timerId);
    }
    this.timerId = null;
    this.deadline = null;
  }

  /**
   * Calls the contacts and ends the trip. Reaching the contacts is the alarm's
   * whole job, so once that is done the panel returns to ready and is free to
   * be tripped again -- whether the contacts were called because time ran out
   * or because a wrong code was entered.
   */
  private notifyContacts(reason: NotifyReason): void {
    const called = this.policy.select(this.contacts.list(), new Date());
    this.emit('alertRaised', { reason, contacts: called });
    for (const contact of called) {
      this.emit('contactCalled', { contact });
    }

    this.stopCountdown();
    this.setState('ready');
  }

  private setState(next: AlarmState): void {
    this.state = next;
    this.emit('stateChanged', { state: next });
  }
}
