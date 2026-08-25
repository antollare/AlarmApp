import { AlarmCode } from './AlarmCode.js';
import { DEFAULT_ITERATIONS } from './crypto.js';
import { DuplicateCodeError, ValidationError } from './errors.js';


const CODE_PATTERN = /^\d{4,10}$/;

/** In-memory collection of alarm codes. */
export class AlarmCodeStore {
  private readonly items: AlarmCode[] = [];

  /** Iteration count is injectable so tests can run cheaply. */
  constructor(private readonly iterations: number = DEFAULT_ITERATIONS) {}

  list(): readonly AlarmCode[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }

  async add(code: string, assignee: string): Promise<AlarmCode> {
    const value = code.trim();
    const owner = assignee.trim();

    if (!CODE_PATTERN.test(value)) {
      throw new ValidationError('Code must be 4 to 10 digits.');
    }
    if (owner.length === 0) {
      throw new ValidationError('Assignee is required.');
    }
    if (await this.verify(value)) {
      throw new DuplicateCodeError('That code is already assigned to someone.');
    }

    const created = await AlarmCode.create(value, owner, this.iterations);
    this.items.push(created);
    return created;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  /**
   * Returns the matching code, or null. Every stored code is tested even after
   * a match is found, so the work done does not depend on which code was
   * entered or where it sits in the list.
   */
  async verify(entered: string): Promise<AlarmCode | null> {
    const value = entered.trim();
    if (value.length === 0) return null;

    let match: AlarmCode | null = null;
    for (const item of this.items) {
      if (await item.matches(value)) {
        match = item;
      }
    }
    return match;
  }
}
