import { TransactionSet } from './TransactionSet';
import Utils from '../../../../utils/Utils';

export class RateResult {
  public amountToConfirm: any;
  public amountToReserve: any;
  public amountToCancel: any;
  public accumulatedAmount: any;
  public transactionSetID: any;
  public transactionsToReserve: any;
  public transactionsToConfirm: any;
  public transactionsToCleanup: any;

  constructor(model) {
    if (model.$attributes.amountToConfirm) {
      this.amountToConfirm = this.parseAmount(model.$attributes.amountToConfirm).value;
    }
    if (model.$attributes.amountToReserve) {
      this.amountToReserve = this.parseAmount(model.$attributes.amountToReserve).value;
    }
    if (model.$attributes.amountToCancel) {
      this.amountToCancel = this.parseAmount(model.$attributes.amountToCancel).value;
    }
    if (model.$attributes.accumulatedAmount) {
      this.accumulatedAmount = this.parseAmount(model.$attributes.accumulatedAmount).value;
    }
    if (model.$attributes.transactionSetID) {
      this.transactionSetID = model.$attributes.transactionSetID;
    }

    if (model.transacSetToReserve) {
      this.transactionsToReserve = new TransactionSet(model.transacSetToReserve);
    }
    if (model.transacSetToConfirm) {
      this.transactionsToConfirm = new TransactionSet(model.transacSetToConfirm);
    }
    if (model.transacSetToCleanup) {
      this.transactionsToCleanup = new TransactionSet(model.transacSetToCleanup);
    }
  }

  /**
   *
   * @param amount {string}
   */
  parseAmount(amount) {
    if (amount) {
      return {
        value: Utils.convertToFloat(amount.substr(4)),
        currency: amount.substr(0, 3)
      };
    }
    return null;
  }
}
