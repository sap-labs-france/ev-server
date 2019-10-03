import Transaction from '../../types/Transaction';

export default interface RefundConnector {
  refund(tenantID: string, userId: string, transactions: Transaction[]): Promise<any>;

  canBeDeleted(transaction: Transaction): boolean;

  updateRefundStatus(id: string, transaction: Transaction): Promise<string>;
}
