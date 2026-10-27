import { PASSWORD_REGEX } from './auth.constants';

describe('PASSWORD_REGEX', () => {
  it('accepts any symbol, not just @$!%*?&', () => {
    expect(PASSWORD_REGEX.test('Fake_pass_42x')).toBe(true);
    expect(PASSWORD_REGEX.test('Abc1_xyz')).toBe(true);
  });

  it('rejects weak, spaced or bcrypt-truncated passwords', () => {
    expect(PASSWORD_REGEX.test('Abcdefg1')).toBe(false);
    expect(PASSWORD_REGEX.test('abcdefg1!')).toBe(false);
    expect(PASSWORD_REGEX.test('Ab1! xyzw')).toBe(false);
    expect(PASSWORD_REGEX.test('Ab1_' + 'x'.repeat(69))).toBe(false);
  });
});
