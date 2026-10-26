import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AuditActionKey } from './audit-action.decorator';

export interface AuditContextData {
  actionKey: AuditActionKey;
  targetType: 'user' | 'room' | 'message' | null;
  targetId?: string;
  targetLabel?: string;
  details: Record<string, unknown>;
}

@Injectable()
export class AdminAuditContext {
  private readonly storage = new AsyncLocalStorage<AuditContextData>();

  run<T>(context: AuditContextData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  setTarget(label: string, id?: string) {
    const context = this.storage.getStore();
    if (context) {
      context.targetLabel = label.slice(0, 255);
      if (id) context.targetId = id;
    }
  }

  setDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
    const context = this.storage.getStore();
    if (context) context.details = { ...context.details, before, after };
  }

  setActionKey(actionKey: AuditActionKey) {
    const context = this.storage.getStore();
    if (context) context.actionKey = actionKey;
  }

  setReason(reason: string) {
    const context = this.storage.getStore();
    if (context) context.details = { ...context.details, reason };
  }

  get() {
    return this.storage.getStore();
  }
}
