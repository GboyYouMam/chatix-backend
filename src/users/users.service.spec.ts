import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService.updateProfile', () => {
  const user = {
    id: 'user-id',
    canChangeProfile: true,
  } as Awaited<ReturnType<UsersService['getUserProfile']>>;
  const repository = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    incrementAura: jest.fn(),
  };
  const storage = { uploadFile: jest.fn() };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findById.mockResolvedValue(user);
    repository.updateProfile.mockResolvedValue({ id: user.id });
    service = new UsersService(repository as never, storage as never);
  });

  it('rejects profile edits when profile changes are frozen', async () => {
    repository.findById.mockResolvedValue({ ...user, canChangeProfile: false });

    await expect(
      service.updateProfile(user.id, { vibe: 'calm' }),
    ).rejects.toThrow(
      new ForbiddenException('ur profile is frozen by the admins. cope.'),
    );
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('passes only editable profile fields to the repository', async () => {
    await service.updateProfile(user.id, {
      username: 'valid_name',
      description: 'hello',
      vibe: 'calm',
      role: 'admin',
      aura: 99,
    } as never);

    expect(repository.updateProfile).toHaveBeenCalledWith(user.id, {
      username: 'valid_name',
      description: 'hello',
      vibe: 'calm',
    });
  });

  it('uses the repository atomic aura increment', async () => {
    repository.incrementAura.mockResolvedValue(8);

    await expect(service.auraFarming(user.id)).resolves.toEqual({
      aura: 8,
      message: 'aura farmed',
    });
    expect(repository.incrementAura).toHaveBeenCalledWith(user.id);
  });
});
