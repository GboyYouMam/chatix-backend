import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { UsersRepository } from '../auth/users.repository';
import { MessagesRepository } from '../messages/messages.repository';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: {} },
        { provide: UsersRepository, useValue: {} },
        { provide: MessagesRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
