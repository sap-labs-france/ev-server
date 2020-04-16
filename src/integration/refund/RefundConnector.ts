import Transaction from '../../types/Transaction';
import { RefundSetting } from '../../types/Setting';
import Connection from '../../types/Connection';

export default abstract class RefundConnector<T extends RefundSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  public abstract async refund(tenantID: string, userId: string, transactions: Transaction[]): Promise<any>;

  public abstract canBeDeleted(transaction: Transaction): boolean;

  public abstract async updateRefundStatus(id: string, transaction: Transaction): Promise<string>;

  public abstract async createConnection(userId: string, data: any): Promise<Connection>;
}
