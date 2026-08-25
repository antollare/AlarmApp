import { Contact } from './Contact.js';
import { newId } from './crypto.js';
import { ValidationError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** In-memory list of contacts, in the order they were added. */
export class ContactStore {
  private readonly items: Contact[] = [];

  list(): readonly Contact[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }

  add(name: string, phone: string, email: string): Contact {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (cleanName.length === 0) {
      throw new ValidationError('Name is required.');
    }
    if (cleanPhone.length === 0 && cleanEmail.length === 0) {
      throw new ValidationError('Give at least a phone number or an email address.');
    }
    if (cleanEmail.length > 0 && !EMAIL_PATTERN.test(cleanEmail)) {
      throw new ValidationError('That email address does not look valid.');
    }

    const created = new Contact(newId(), cleanName, cleanPhone, cleanEmail);
    this.items.push(created);
    return created;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
}
