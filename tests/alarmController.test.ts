import { beforeEach, describe, expect, it } from 'vitest';
import { AlarmController, type AlarmState } from '../src/controller/AlarmController.js';
import { AlarmCodeStore } from '../src/model/AlarmCodeStore.js';
import { ContactStore } from '../src/model/ContactStore.js';
import { FakeScheduler } from './FakeScheduler.js';

const FAST = 1000;
const COUNTDOWN_MS = 30_000;

describe('AlarmController', () => {
  let controller: AlarmController;
  let clock: FakeScheduler;
  let calledNames: string[];
  let alerts: string[];
  let states: AlarmState[];

  beforeEach(async () => {
    clock = new FakeScheduler();
    controller = new AlarmController(new AlarmCodeStore(FAST), new ContactStore(), {
      scheduler: clock,
      countdownMs: COUNTDOWN_MS,
    });

    calledNames = [];
    alerts = [];
    states = [];

    controller.on('contactCalled', ({ contact }) => calledNames.push(contact.name));
    controller.on('alertRaised', ({ reason }) => alerts.push(reason));
    controller.on('stateChanged', ({ state }) => states.push(state));

    await controller.addCode('1234', 'Ada');
    controller.addContact('Grace', '555-0100', 'grace@example.com');
    controller.addContact('Alan', '555-0101', 'alan@example.com');
  });

  it('starts ready', () => {
    expect(controller.getState()).toBe('ready');
    expect(controller.getRemainingMs()).toBe(0);
  });

  it('trips once and starts the countdown', () => {
    controller.trip();
    controller.trip();

    expect(controller.getState()).toBe('tripped');
    expect(states).toEqual(['tripped']);
    expect(controller.getRemainingMs()).toBe(COUNTDOWN_MS);
  });

  it('counts down each second while tripped', () => {
    const ticks: number[] = [];
    controller.on('countdownTick', ({ remainingMs }) => ticks.push(remainingMs));

    controller.trip();
    clock.advance(3000);

    expect(ticks.slice(0, 4)).toEqual([30_000, 29_000, 28_000, 27_000]);
    expect(controller.getRemainingMs()).toBe(27_000);
  });

  describe('when the countdown runs out', () => {
    beforeEach(() => {
      controller.trip();
      clock.advance(COUNTDOWN_MS);
    });

    it('calls every contact, in list order', () => {
      expect(alerts).toEqual(['no-code']);
      expect(calledNames).toEqual(['Grace', 'Alan']);
    });

    it('returns to ready and stops the timer', () => {
      expect(controller.getState()).toBe('ready');
      expect(states).toEqual(['tripped', 'ready']);
      expect(clock.activeTimers).toBe(0);
      expect(controller.getRemainingMs()).toBe(0);
    });

    it('does not call anyone a second time', () => {
      clock.advance(60_000);
      expect(alerts).toEqual(['no-code']);
      expect(calledNames).toEqual(['Grace', 'Alan']);
    });
  });

  it('notifies on a wrong code, then ends the trip', async () => {
    controller.trip();
    clock.advance(5000);

    const result = await controller.submitCode('0000');

    expect(result).toEqual({ outcome: 'rejected', reason: 'incorrect-code' });
    expect(alerts).toEqual(['incorrect-code']);
    expect(calledNames).toEqual(['Grace', 'Alan']);
    expect(controller.getState()).toBe('ready');
    expect(states).toEqual(['tripped', 'ready']);
    expect(clock.activeTimers).toBe(0);

    // The countdown was cancelled, so nobody is called a second time.
    clock.advance(60_000);
    expect(alerts).toEqual(['incorrect-code']);
    expect(calledNames).toEqual(['Grace', 'Alan']);
  });

  it('can be tripped again after the contacts have been called', async () => {
    controller.trip();
    await controller.submitCode('0000');
    expect(controller.getState()).toBe('ready');

    controller.trip();
    expect(controller.getState()).toBe('tripped');
    expect(controller.getRemainingMs()).toBe(COUNTDOWN_MS);

    clock.advance(COUNTDOWN_MS);
    expect(alerts).toEqual(['incorrect-code', 'no-code']);
    expect(controller.getState()).toBe('ready');
  });

  it('does nothing on an empty entry -- the countdown decides', async () => {
    controller.trip();
    const result = await controller.submitCode('   ');

    expect(result).toEqual({ outcome: 'empty' });
    expect(alerts).toEqual([]);
    expect(calledNames).toEqual([]);
    expect(controller.getRemainingMs()).toBe(COUNTDOWN_MS);
  });

  it('clears the alarm on a correct code and cancels the countdown', async () => {
    controller.trip();
    clock.advance(10_000);

    const result = await controller.submitCode('1234');

    expect(result).toEqual({ outcome: 'accepted', assignee: 'Ada' });
    expect(controller.getState()).toBe('ready');
    expect(states).toEqual(['tripped', 'ready']);
    expect(clock.activeTimers).toBe(0);

    clock.advance(60_000);
    expect(alerts).toEqual([]);
    expect(calledNames).toEqual([]);
  });

  it('ignores code entry while the alarm is ready', async () => {
    const result = await controller.submitCode('0000');

    expect(result).toEqual({ outcome: 'ignored' });
    expect(alerts).toEqual([]);
    expect(calledNames).toEqual([]);
  });

  it('resets without a code and cancels the countdown', () => {
    controller.trip();
    clock.advance(10_000);
    controller.reset();

    expect(controller.getState()).toBe('ready');
    expect(states).toEqual(['tripped', 'ready']);
    expect(clock.activeTimers).toBe(0);

    clock.advance(60_000);
    expect(alerts).toEqual([]);
    expect(calledNames).toEqual([]);
  });

  it('restarts a full countdown on the next trip', () => {
    controller.trip();
    clock.advance(20_000);
    controller.reset();

    controller.trip();
    expect(controller.getRemainingMs()).toBe(COUNTDOWN_MS);
  });

  it('raises the alert even with no contacts on file', () => {
    const empty = new AlarmController(new AlarmCodeStore(FAST), new ContactStore(), {
      scheduler: clock,
      countdownMs: COUNTDOWN_MS,
    });
    const seen: string[] = [];
    empty.on('alertRaised', ({ reason }) => seen.push(reason));
    empty.on('contactCalled', () => seen.push('called'));

    empty.trip();
    clock.advance(COUNTDOWN_MS);

    expect(seen).toEqual(['no-code']);
  });
});
