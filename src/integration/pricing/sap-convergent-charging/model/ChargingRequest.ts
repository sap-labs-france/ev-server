import { ChargeableItem } from './ChargeableItem';

export class ChargingRequest {
  public chargeableItem: ChargeableItem;
  public transactionSelection: any;
  public filterTransaction: any;

  /**
   *
   * @param chargeableItem {ChargeableItem}
   * @param transactionSelection {string}
   * @param filterTransaction {string}
   */
  constructor(chargeableItem, transactionSelection, filterTransaction) {
    this.chargeableItem = chargeableItem;
    this.transactionSelection = transactionSelection;
    this.filterTransaction = filterTransaction;
  }
}
