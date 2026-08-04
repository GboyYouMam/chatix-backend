import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  it('rejects more than five attachments', async () => {
    const service = new MessagesService({} as any, {} as any);

    await expect(
      service.sendMessage('room', 'user', '', undefined, Array(6) as any),
    ).rejects.toThrow('at most 5 files');
  });
});
