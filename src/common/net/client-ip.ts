import type { Request } from 'express';
import type { Socket } from 'socket.io';
import proxyAddr from 'proxy-addr';

export type ClientIpConfig = {
  trustProxy?: string;
  trustedIpHeader?: string;
};

export function normalizeIp(ip: string): string {
  return ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : ip;
}

function headerIp(value: string | string[] | undefined): string | undefined {
  const ip = Array.isArray(value) ? value[0] : value;
  return ip?.split(',')[0]?.trim() || undefined;
}

export function getClientIp(req: Request, config: ClientIpConfig): string {
  const trusted = config.trustedIpHeader
    ? headerIp(req.headers[config.trustedIpHeader.toLowerCase()])
    : undefined;
  return normalizeIp(trusted ?? req.ip ?? req.socket.remoteAddress ?? '');
}

export function getSocketClientIp(
  socket: Socket,
  config: ClientIpConfig,
): string {
  const headers = socket.handshake.headers;
  const trusted = config.trustedIpHeader
    ? headerIp(headers[config.trustedIpHeader.toLowerCase()])
    : undefined;
  const address = socket.handshake.address ?? socket.conn.remoteAddress ?? '';
  const request = {
    headers,
    socket: { remoteAddress: address },
  };
  const trust = config.trustProxy
    ? /^\d+$/.test(config.trustProxy.trim())
      ? (_address: string, hop: number) => hop < Number(config.trustProxy)
      : proxyAddr.compile(
          config.trustProxy.split(',').map((value) => value.trim()),
        )
    : () => false;
  return normalizeIp(trusted ?? proxyAddr(request, trust));
}
