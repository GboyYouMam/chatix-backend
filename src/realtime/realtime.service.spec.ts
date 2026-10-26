import { RealtimeService } from './realtime.service';
import type { Namespace } from 'socket.io';
it('routes admin events only to admin namespace and disconnects in every namespace', () => {
  const service = new RealtimeService();
  const make = () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const disconnectSockets = jest.fn();
    const inside = jest.fn(() => ({ disconnectSockets }));
    const namespace = { to, in: inside } as unknown as Namespace;
    return { namespace, to, disconnectSockets };
  };
  const root = make();
  const admin = make();
  const fight = make();
  service.register('/', root.namespace);
  service.register('/admin', admin.namespace);
  service.register('/fight-club', fight.namespace);
  service.emitToAdmins('e', {});
  expect(admin.to).toHaveBeenCalledWith('admins');
  expect(root.to).not.toHaveBeenCalled();
  service.disconnectUser('u1');
  for (const server of [root, admin, fight])
    expect(server.disconnectSockets).toHaveBeenCalledWith(true);
});
