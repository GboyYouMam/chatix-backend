import { MessagesController } from './messages.controller';

describe('MessagesController', () => {
  it('saves and broadcasts uploaded attachments', async () => {
    const message = { id: 'message-id' };
    const messagesService = { sendMessage: jest.fn().mockResolvedValue(message) };
    const messagesGateway = { broadcastMessage: jest.fn() };
    const controller = new MessagesController(
      messagesService as any,
      messagesGateway as any,
    );
    const files = [{ originalname: 'image.png' }] as Express.Multer.File[];

    await expect(
      controller.createMessage(
        { roomId: 'room-id', cipherText: '' },
        { userId: 'user-id' } as any,
        '127.0.0.1',
        files,
      ),
    ).resolves.toBe(message);

    expect(messagesService.sendMessage).toHaveBeenCalledWith(
      'room-id',
      'user-id',
      '',
      '127.0.0.1',
      files,
    );
    expect(messagesGateway.broadcastMessage).toHaveBeenCalledWith('room-id', message);
  });
});
