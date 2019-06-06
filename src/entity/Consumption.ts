import Database from '../utils/Database';
import TenantHolder from './TenantHolder';

export default class Consumption extends TenantHolder {
  
  private model: any = {};

  constructor(tenantID, consumptionModel) {
    super(tenantID);
    if (consumptionModel) {
      Database.updateConsumption(consumptionModel, this.model);
    }
  }

  getID() {
    return this.model.id;
  }

  getModel() {
    return this.model;
  }

  getUserID() {
    return this.model.userID;
  }

  getChargeBoxID() {
    return this.model.chargeBoxID;
  }

  getSiteID() {
    return this.model.siteID;
  }

  getSiteAreaID() {
    return this.model.siteAreaID;
  }

  getConnectorId() {
    return this.model.connectorId;
  }

  getTransactionId() {
    return this.model.transactionId;
  }

  getStartedAt() {
    return this.model.startedAt;
  }

  getEndedAt() {
    return this.model.endedAt;
  }

  getStateOfCharge() {
    return this.model.stateOfCharge;
  }

  getCumulatedConsumption() {
    return this.model.cumulatedConsumption;
  }

  getConsumption() {
    return this.model.consumption;
  }

  getAmount() {
    return this.model.amount;
  }

  getCumulatedAmount() {
    return this.model.cumulatedAmount;
  }

  getCurrency() {
    return this.model.currencyCode;
  }

}
