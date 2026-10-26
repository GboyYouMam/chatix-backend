import { createHmac } from 'node:crypto';
import { normalizeIp } from './client-ip';

export function ipTag(ip: string, secret: string): string {
  const normalized = normalizeIp(ip).toLowerCase();
  const [left, right = ''] = normalized.split('::');
  const leading = left ? left.split(':') : [];
  const trailing = right ? right.split(':') : [];
  const hextets = [
    ...leading,
    ...Array<string>(8 - leading.length - trailing.length).fill('0'),
    ...trailing,
  ];
  const canonicalHextets = hextets.map((hextet) =>
    Number.parseInt(hextet, 16).toString(16),
  );
  const canonical = normalized.includes('.')
    ? normalized
    : canonicalHextets.join(':');
  const digest = createHmac('sha256', secret)
    .update(canonical)
    .digest('hex')
    .slice(0, 3);
  if (normalized.includes('.')) {
    return [...normalized.split('.').slice(0, 3), `#${digest}`].join('.');
  }
  return `${canonicalHextets.slice(0, 3).join(':')}::#${digest}`;
}
