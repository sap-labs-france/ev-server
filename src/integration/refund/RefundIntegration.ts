import Connection from '../../types/Connection';
import { RefundSetting } from '../../types/Setting';
import { RefundStatus } from '../../types/Refund';
import Transaction from '../../types/Transaction';

export default abstract class RefundIntegration<T extends RefundSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  public abstract async refund(tenantID: string, userId: string, transactions: Transaction[]): Promise<Transaction[]>;

  public abstract canBeDeleted(transaction: Transaction): boolean;

  public abstract async updateRefundStatus(id: string, transaction: Transaction): Promise<RefundStatus>;

  public abstract async createConnection(userID: string, data: unknown): Promise<Connection>;
}
