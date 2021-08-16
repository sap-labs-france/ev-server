/* eslint-disable @typescript-eslint/no-unused-vars */
import Connection from '../../../types/Connection';
import RefundIntegration from '../RefundIntegration';
import { RefundSetting } from '../../../types/Setting';
import { RefundStatus } from '../../../types/Refund';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';

export default class DummyRefundIntegration extends RefundIntegration<RefundSetting> {
  constructor(tenant: Tenant, setting: RefundSetting) {
    super(tenant, setting);
  }

  public async refund(userID: string, transactions: Transaction[]): Promise<Transaction[]> {
    return null;
  }

  public canBeDeleted(transaction: Transaction): boolean {
    return false;
  }

  public async updateRefundStatus(tenant: Tenant, transaction: Transaction): Promise<RefundStatus> {
    return null;
  }

  public async createConnection(userID: string, data: unknown): Promise<Connection> {
    return null;
  }

  public async checkConnection(userID: string): Promise<void> {
  }
}
