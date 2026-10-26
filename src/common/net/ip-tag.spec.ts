import { ipTag } from './ip-tag';

describe('ipTag', () => {
  const secret = '0123456789abcdef0123456789abcdef';

  it('keeps the first three IPv4 octets and hides the last', () => {
    const tag = ipTag('93.184.216.34', secret);
    expect(tag).toMatch(/^93\.184\.216\.#[a-f0-9]{3}$/);
    expect(tag).toBe(ipTag('93.184.216.34', secret));
    expect(tag).not.toContain('34');
    expect(tag).not.toBe(ipTag('93.184.216.35', secret));
    expect(ipTag('::ffff:93.184.216.34', secret)).toBe(tag);
  });

  it('keeps only three IPv6 hextets before its digest', () => {
    expect(ipTag('2001:db8:85a3:8d3:1319:8a2e:370:7348', secret)).toMatch(
      /^2001:db8:85a3::#[a-f0-9]{3}$/,
    );
    expect(ipTag('2001:db8::1', secret)).toMatch(/^2001:db8:0::#[a-f0-9]{3}$/);
    expect(ipTag('2001:0db8:0000:0000:0000:0000:0000:0001', secret)).toBe(
      ipTag('2001:db8::1', secret),
    );
  });
});
