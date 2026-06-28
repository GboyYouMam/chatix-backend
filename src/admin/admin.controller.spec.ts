import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminActivityLogger } from './admin-activity-logger.service';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: {} },
        { provide: AdminAuditInterceptor, useValue: { intercept: jest.fn() } },
        { provide: AdminActivityLogger, useValue: { record: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
