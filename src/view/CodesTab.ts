import type { AlarmController } from '../controller/AlarmController.js';
import { el, qs } from './dom.js';

/**
 * Tab one: the codes on file and the people to contact when the alarm trips.
 *
 * Codes are shown as a fixed mask. The plaintext is not recoverable once
 * hashed and the length is not stored, so "a list of alarm codes" can only
 * mean assignee plus a placeholder that reveals nothing.
 */
export class CodesTab {
  readonly element = el('section', { class: 'panel', id: 'panel-codes' });

  private readonly codeRows: HTMLTableSectionElement;
  private readonly contactRows: HTMLTableSectionElement;
  private readonly codeForm: HTMLFormElement;
  private readonly contactForm: HTMLFormElement;
  private readonly codeError: HTMLElement;
  private readonly contactError: HTMLElement;

  constructor(private readonly controller: AlarmController) {
    this.element.innerHTML = `
      <div class="card">
        <header class="card-head">
          <h2>Alarm codes</h2>
          <p class="hint">Codes are stored as salted hashes. A code can be deleted and replaced, never revealed.</p>
        </header>
        <table class="grid">
          <thead>
            <tr><th>Assignee</th><th>Code</th><th>Date added</th><th class="right">Actions</th></tr>
          </thead>
          <tbody data-rows="codes"></tbody>
        </table>
        <form class="row-form" data-form="code" novalidate>
          <label>Code<input name="code" inputmode="numeric" autocomplete="off" placeholder="4-10 digits" /></label>
          <label>Assignee<input name="assignee" autocomplete="off" placeholder="Name" /></label>
          <button type="submit">Add code</button>
          <p class="error" data-error="code" role="alert"></p>
        </form>
      </div>

      <div class="card">
        <header class="card-head">
          <h2>Contact info for alarm trip</h2>
          <p class="hint">Everyone on this list is called when the alarm is tripped.</p>
        </header>
        <table class="grid">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Email</th><th class="right">Actions</th></tr>
          </thead>
          <tbody data-rows="contacts"></tbody>
        </table>
        <form class="row-form" data-form="contact" novalidate>
          <label>Name<input name="name" autocomplete="off" placeholder="Name" /></label>
          <label>Phone<input name="phone" autocomplete="off" placeholder="555-0100" /></label>
          <label>Email<input name="email" autocomplete="off" placeholder="name@example.com" /></label>
          <button type="submit">Add contact</button>
          <p class="error" data-error="contact" role="alert"></p>
        </form>
      </div>
    `;

    this.codeRows = qs(this.element, '[data-rows="codes"]');
    this.contactRows = qs(this.element, '[data-rows="contacts"]');
    this.codeForm = qs(this.element, '[data-form="code"]');
    this.contactForm = qs(this.element, '[data-form="contact"]');
    this.codeError = qs(this.element, '[data-error="code"]');
    this.contactError = qs(this.element, '[data-error="contact"]');

    this.codeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submitCode();
    });
    this.contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitContact();
    });

    controller.on('codesChanged', () => this.renderCodes());
    controller.on('contactsChanged', () => this.renderContacts());

    this.renderCodes();
    this.renderContacts();
  }

  private async submitCode(): Promise<void> {
    const data = new FormData(this.codeForm);
    this.codeError.textContent = '';
    try {
      await this.controller.addCode(String(data.get('code') ?? ''), String(data.get('assignee') ?? ''));
      this.codeForm.reset();
    } catch (error) {
      this.codeError.textContent = error instanceof Error ? error.message : 'Could not add that code.';
    }
  }

  private submitContact(): void {
    const data = new FormData(this.contactForm);
    this.contactError.textContent = '';
    try {
      this.controller.addContact(
        String(data.get('name') ?? ''),
        String(data.get('phone') ?? ''),
        String(data.get('email') ?? ''),
      );
      this.contactForm.reset();
    } catch (error) {
      this.contactError.textContent = error instanceof Error ? error.message : 'Could not add that contact.';
    }
  }

  private renderCodes(): void {
    const codes = this.controller.codes.list();
    if (codes.length === 0) {
      this.codeRows.replaceChildren(emptyRow(4, 'No codes yet.'));
      return;
    }

    this.codeRows.replaceChildren(
      ...codes.map((code) => {
        const del = el('button', { class: 'ghost', type: 'button' }, 'Delete');
        del.addEventListener('click', () => this.controller.removeCode(code.id));
        return el(
          'tr',
          {},
          el('td', {}, code.assignee),
          el('td', { class: 'mono' }, code.masked),
          el('td', { class: 'muted' }, code.createdAt.toLocaleDateString()),
          el('td', { class: 'right' }, del),
        );
      }),
    );
  }

  private renderContacts(): void {
    const contacts = this.controller.contacts.list();
    if (contacts.length === 0) {
      this.contactRows.replaceChildren(emptyRow(4, 'No contacts yet.'));
      return;
    }

    this.contactRows.replaceChildren(
      ...contacts.map((contact) => {
        const del = el('button', { class: 'ghost', type: 'button' }, 'Delete');
        del.addEventListener('click', () => this.controller.removeContact(contact.id));
        return el(
          'tr',
          {},
          el('td', {}, contact.name),
          el('td', { class: 'mono' }, contact.phone || '—'),
          el('td', {}, contact.email || '—'),
          el('td', { class: 'right' }, del),
        );
      }),
    );
  }
}

function emptyRow(span: number, message: string): HTMLTableRowElement {
  return el('tr', {}, el('td', { class: 'muted', colspan: String(span) }, message));
}
