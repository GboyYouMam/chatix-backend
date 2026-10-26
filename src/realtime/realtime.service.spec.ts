import { RealtimeService } from './realtime.service';
it('routes admin events only to admin namespace and disconnects in every namespace', () => {
  const service = new RealtimeService();
  const make = () =>
    ({
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      disconnectSockets: jest.fn(),
    }) as any;
  const root = make(),
    admin = make(),
    fight = make();
  service.register('/', root);
  service.register('/admin', admin);
  service.register('/fight-club', fight);
  service.emitToAdmins('e', {});
  expect(admin.to).toHaveBeenCalledWith('admins');
  expect(root.to).not.toHaveBeenCalled();
  service.disconnectUser('u1');
  for (const server of [root, admin, fight])
    expect(server.disconnectSockets).toHaveBeenCalledWith(true);
});
