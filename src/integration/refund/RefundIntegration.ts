import Connection from '../../types/Connection';
import { RefundSetting } from '../../types/Setting';
import { RefundStatus } from '../../types/Refund';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';

export default abstract class RefundIntegration<T extends RefundSetting> {
  protected readonly tenant: Tenant;
  protected readonly setting: T;

  protected constructor(tenant: Tenant, setting: T) {
    this.tenant = tenant;
    this.setting = setting;
  }

  public abstract refund(userID: string, transactions: Transaction[]): Promise<Transaction[]>;

  public abstract canBeDeleted(transaction: Transaction): boolean;

  public abstract updateRefundStatus(tenant: Tenant, transaction: Transaction): Promise<RefundStatus>;

  public abstract createConnection(userID: string, data: unknown): Promise<Connection>;

  public abstract checkConnection(userID: string): Promise<void>;
}
