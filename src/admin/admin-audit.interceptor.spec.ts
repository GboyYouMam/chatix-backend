import { of } from 'rxjs';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminActivityLogger } from './admin-activity-logger.service';

describe('AdminAuditInterceptor', () => {
  it('does not audit a non-admin request', (done) => {
    const record = jest.fn();
    const activityLogger = {
      record,
    } as unknown as AdminActivityLogger;
    const interceptor = new AdminAuditInterceptor(activityLogger);
    const request = { user: { role: 'user' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 200 }),
      }),
      getHandler: () => ({}),
    };

    interceptor
      .intercept(context as never, { handle: () => of('ok') })
      .subscribe(() => {
        expect(record).not.toHaveBeenCalled();
        done();
      });
  });
});
