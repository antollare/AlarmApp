# Alarm App

A TypeScript web app implementing [design.txt](design.txt): manage alarm codes and
trip contacts, and exercise them against a test alarm.

## Running it

Requires Node 18 or newer.

```
npm install
npm run dev        # http://localhost:5173
npm test           # model + controller suites
npm run typecheck
npm run build
```

There is no seed data. Add a code and a contact on the first tab, then use the
Test tab.

## Layout

Model, view, and controller are kept in separate directories, and the
dependency only points one way — views import the controller, the controller
imports the model, and the model imports nothing from either.

```
src/model/       AlarmCode, AlarmCodeStore, Contact, ContactStore, NotifyPolicy
src/controller/  AlarmController (state machine + countdown + events), Emitter, Scheduler
src/view/        App shell, CodesTab, TestTab, PopupStack
tests/           model and controller suites — no DOM required
```

The controller never touches the DOM. "Calling" a contact is a `contactCalled`
event; the view is what turns it into a pop up. That is what lets the whole
trip sequence be tested without a browser.

## How the decisions in design.txt are implemented

1. **The code list shows `Assignee | Code | Date added | [Delete]`.** The mask is
   a fixed `****`, and code length is not stored at all, so the list leaks
   nothing about the code. There is no reveal path — a code can only be deleted
   and replaced.
2. **Tripping starts a 30s countdown.** `AlarmController` owns it and emits
   `countdownTick` once a second; the status area reads
   `TRIPPED — 12s remaining`. Running out of time is what counts as "no code
   entered", so it calls the contacts. Submitting an empty keypad is
   deliberately silent — the countdown decides, not the Enter key. A wrong code
   calls the contacts immediately, without waiting for the countdown.
3. **Calling the contacts ends the trip.** Either path — expiry or a wrong code
   — cancels the countdown and returns the alarm to ready, free to be tripped
   again. Reaching the contacts is the alarm's whole job, so one trip notifies
   exactly once. A correct code clears the alarm without calling anybody.
4. **The reset button is unauthenticated.** It clears the alarm and cancels the countdown
   with no code, per the doc. Known non-security, not an oversight.
5. **Hashing: per-code 16-byte random salt, PBKDF2-SHA256, 100k iterations.**
   See the note below — this is ahead of what the doc specifies.

The countdown timer is injected as a [`Scheduler`](src/controller/Scheduler.ts)
so tests drive time directly instead of waiting on the clock.

### One place the code is ahead of the doc

The doc specifies salted SHA-256 and lists "swap SHA-256 for a real KDF
(PBKDF2, bcrypt, or Argon2)" as an improvement. That improvement is already
done — the code uses PBKDF2-SHA256 at 100k iterations. Deliberately downgrading
to bare SHA-256 to match the doc would only make the app weaker, so the doc's
improvement line is the thing that is now out of date.

The doc's honest framing still holds either way: this is defence against
disclosure, not against a determined attacker. For short numeric codes the
keyspace is tiny (10,000 values for 4 digits), so the remaining half of that
improvement — raising the minimum code length — is the one that would actually
matter.

### Two consequences worth knowing

- Verification is O(number of codes). Per-code salts mean there is no key to
  index on, so an entered code is tested against every stored salt. Every code
  is checked even after a match, so the work does not vary with which code was
  entered.
- Storage is in memory. Reloading the page clears everything. The stores are
  the only place that would need to change.

## The remaining improvement

`NotifyPolicy` in [src/model/NotifyPolicy.ts](src/model/NotifyPolicy.ts) is the
seam for the time-of-day field. `callEveryone` is the current policy; adding a
time window to `Contact` and writing a second policy is the whole change — the
controller and views do not move.
