/* eslint-disable @typescript-eslint/no-unused-vars */
import Connection from '../../../types/Connection';
import RefundIntegration from '../RefundIntegration';
import { RefundSetting } from '../../../types/Setting';
import { RefundStatus } from '../../../types/Refund';
import Transaction from '../../../types/Transaction';

export default class DummyRefundIntegration extends RefundIntegration<RefundSetting> {
  constructor(tenantID: string, setting: RefundSetting) {
    super(tenantID, setting);
  }

  public async refund(tenantID: string, userId: string, transactions: Transaction[]): Promise<Transaction[]> {
    return null;
  }

  public canBeDeleted(transaction: Transaction): boolean {
    return false;
  }

  public async updateRefundStatus(id: string, transaction: Transaction): Promise<RefundStatus> {
    return null;
  }

  public async createConnection(userId: string, data: unknown): Promise<Connection> {
    return null;
  }
}
