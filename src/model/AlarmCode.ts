import { DEFAULT_ITERATIONS, deriveHash, equalsConstantTime, newId, randomSalt } from './crypto.js';

/** Fixed placeholder shown in place of a code. Reveals nothing, not even length. */
const MASK = '****';

/**
 * One alarm code and the person it belongs to.
 *
 * The plaintext code is used once, to derive the digest, and is then gone --
 * there is no getter for it and no field holding it. Nor is its length kept,
 * so the codes tab can only ever show a fixed mask plus the assignee.
 */
export class AlarmCode {
  private constructor(
    readonly id: string,
    readonly assignee: string,
    readonly createdAt: Date,
    private readonly salt: Uint8Array,
    private readonly digest: Uint8Array,
    private readonly iterations: number,
  ) {}

  static async create(
    code: string,
    assignee: string,
    iterations: number = DEFAULT_ITERATIONS,
  ): Promise<AlarmCode> {
    const salt = randomSalt();
    const digest = await deriveHash(code, salt, iterations);
    return new AlarmCode(newId(), assignee, new Date(), salt, digest, iterations);
  }

  async matches(entered: string): Promise<boolean> {
    if (entered.length === 0) return false;
    const candidate = await deriveHash(entered, this.salt, this.iterations);
    return equalsConstantTime(candidate, this.digest);
  }

  get masked(): string {
    return MASK;
  }
}
