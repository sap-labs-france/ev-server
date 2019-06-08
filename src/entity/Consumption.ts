import Database from '../utils/Database';
import TenantHolder from './TenantHolder';

export default class Consumption extends TenantHolder {
  private _model: any = {};

  constructor(tenantID, consumptionModel) {
    super(tenantID);
    if (consumptionModel) {
      Database.updateConsumption(consumptionModel, this._model);
    }
  }

  public getModel(): any {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  getUserID() {
    return this._model.userID;
  }

  getChargeBoxID() {
    return this._model.chargeBoxID;
  }

  getSiteID() {
    return this._model.siteID;
  }

  getSiteAreaID() {
    return this._model.siteAreaID;
  }

  getConnectorId() {
    return this._model.connectorId;
  }

  getTransactionId() {
    return this._model.transactionId;
  }

  getStartedAt() {
    return this._model.startedAt;
  }

  getEndedAt() {
    return this._model.endedAt;
  }

  getStateOfCharge() {
    return this._model.stateOfCharge;
  }

  getCumulatedConsumption() {
    return this._model.cumulatedConsumption;
  }

  getConsumption() {
    return this._model.consumption;
  }

  getAmount() {
    return this._model.amount;
  }

  getCumulatedAmount() {
    return this._model.cumulatedAmount;
  }

  getCurrency() {
    return this._model.currencyCode;
  }

}
