import { describe, expect, it } from 'vitest';
import { AlarmCode } from '../src/model/AlarmCode.js';
import { AlarmCodeStore } from '../src/model/AlarmCodeStore.js';
import { DuplicateCodeError, ValidationError } from '../src/model/errors.js';

const FAST = 1000; // low iteration count keeps the suite quick

function internals(code: AlarmCode): { salt: Uint8Array; digest: Uint8Array } {
  return code as unknown as { salt: Uint8Array; digest: Uint8Array };
}

describe('AlarmCode', () => {
  it('accepts the code it was created with', async () => {
    const code = await AlarmCode.create('1234', 'Ada', FAST);
    await expect(code.matches('1234')).resolves.toBe(true);
  });

  it('rejects a wrong code and an empty one', async () => {
    const code = await AlarmCode.create('1234', 'Ada', FAST);
    await expect(code.matches('4321')).resolves.toBe(false);
    await expect(code.matches('')).resolves.toBe(false);
  });

  it('does not retain the plaintext code anywhere on the instance', async () => {
    const code = await AlarmCode.create('1234', 'Ada', FAST);
    const values = Object.values(code as unknown as Record<string, unknown>);
    expect(values).not.toContain('1234');
  });

  it('salts each code separately, so identical codes store different digests', async () => {
    const a = await AlarmCode.create('1234', 'Ada', FAST);
    const b = await AlarmCode.create('1234', 'Grace', FAST);
    expect([...internals(a).salt]).not.toEqual([...internals(b).salt]);
    expect([...internals(a).digest]).not.toEqual([...internals(b).digest]);
  });

  it('masks with a fixed placeholder that does not leak the length', async () => {
    const short = await AlarmCode.create('1234', 'Ada', FAST);
    const long = await AlarmCode.create('1234567890', 'Grace', FAST);
    expect(short.masked).toBe('****');
    expect(long.masked).toBe(short.masked);
  });
});

describe('AlarmCodeStore', () => {
  it('verifies a stored code and reports its assignee', async () => {
    const store = new AlarmCodeStore(FAST);
    await store.add('1234', 'Ada');
    await store.add('9876', 'Grace');

    const match = await store.verify('9876');
    expect(match?.assignee).toBe('Grace');
  });

  it('returns null for an unknown or empty code', async () => {
    const store = new AlarmCodeStore(FAST);
    await store.add('1234', 'Ada');

    await expect(store.verify('0000')).resolves.toBeNull();
    await expect(store.verify('')).resolves.toBeNull();
  });

  it('refuses a code that is already assigned', async () => {
    const store = new AlarmCodeStore(FAST);
    await store.add('1234', 'Ada');
    await expect(store.add('1234', 'Grace')).rejects.toBeInstanceOf(DuplicateCodeError);
    expect(store.size).toBe(1);
  });

  it('validates the code format and the assignee', async () => {
    const store = new AlarmCodeStore(FAST);
    await expect(store.add('12', 'Ada')).rejects.toBeInstanceOf(ValidationError);
    await expect(store.add('abcd', 'Ada')).rejects.toBeInstanceOf(ValidationError);
    await expect(store.add('1234', '  ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('removes a code so it no longer verifies', async () => {
    const store = new AlarmCodeStore(FAST);
    const code = await store.add('1234', 'Ada');

    expect(store.remove(code.id)).toBe(true);
    await expect(store.verify('1234')).resolves.toBeNull();
    expect(store.remove(code.id)).toBe(false);
  });
});
