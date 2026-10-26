import { getClientIp, getSocketClientIp } from './client-ip';
import type { Socket } from 'socket.io';

describe('client IP trust', () => {
  const socket = (address: string, forwarded?: string) =>
    ({
      handshake: {
        address,
        headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
      },
      conn: { remoteAddress: address },
    }) as unknown as Socket;

  it('ignores forwarded IPs unless proxy trust is configured', () => {
    expect(getSocketClientIp(socket('10.0.0.2', '93.184.216.34'), {})).toBe(
      '10.0.0.2',
    );
    expect(
      getSocketClientIp(socket('10.0.0.2', '93.184.216.34'), {
        trustProxy: '1',
      }),
    ).toBe('93.184.216.34');
  });

  it('uses an explicitly configured client IP header before req.ip', () => {
    const req = {
      ip: '10.0.0.2',
      headers: { 'cf-connecting-ip': '93.184.216.34' },
      socket: { remoteAddress: '10.0.0.2' },
    } as never;
    expect(getClientIp(req, { trustedIpHeader: 'cf-connecting-ip' })).toBe(
      '93.184.216.34',
    );
  });
});
