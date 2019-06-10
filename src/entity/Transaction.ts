import User from './User';
import moment from 'moment';
import Database from '../utils/Database';
import TenantHolder from './TenantHolder';
import UserStorage from '../storage/mongodb/UserStorage';
import ConsumptionStorage from '../storage/mongodb/ConsumptionStorage';
import TransactionStorage from '../storage/mongodb/TransactionStorage';
import OCPPStorage from '../storage/mongodb/OCPPStorage';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import ChargingStation from './ChargingStation';

export default class Transaction extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, transaction: any) {
    super(tenantID);
    Database.updateTransaction(transaction, this._model);
  }

  public getModel(): any {
    return this._model;
  }

  getCurrentTotalInactivitySecs() {
    return this._model.currentTotalInactivitySecs;
  }

  setCurrentTotalInactivitySecs(currentTotalInactivitySecs) {
    this._model.currentTotalInactivitySecs = currentTotalInactivitySecs;
  }

  getLastMeterValue() {
    return this._model.lastMeterValue;
  }

  setLastConsumptionMeterValue(lastMeterValue) {
    this._model.lastMeterValue = lastMeterValue;
  }

  getCurrentStateOfCharge() {
    return this._model.currentStateOfCharge;
  }

  setCurrentStateOfCharge(currentStateOfCharge) {
    this._model.currentStateOfCharge = currentStateOfCharge;
  }

  getNumberOfMeterValues() {
    return this._model.numberOfMeterValues;
  }

  setNumberOfConsumptionMeterValues(numberOfMeterValues) {
    this._model.numberOfMeterValues = numberOfMeterValues;
  }

  getCurrentConsumption() {
    return this._model.currentConsumption;
  }

  setCurrentConsumption(currentConsumption) {
    this._model.currentConsumption = currentConsumption;
  }

  setCurrentConsumptionWh(currentConsumptionWh) {
    this._model.currentConsumptionWh = currentConsumptionWh;
  }

  getCurrentConsumptionWh() {
    return this._model.currentConsumptionWh ? this._model.currentConsumptionWh : 0;
  }

  getCurrentCumulatedPrice() {
    return this._model.currentCumulatedPrice ? this._model.currentCumulatedPrice : 0;
  }

  setCurrentCumulatedPrice(currentCumulatedPrice) {
    this._model.currentCumulatedPrice = currentCumulatedPrice;
  }

  getCurrentTotalConsumption() {
    return this._model.currentTotalConsumption;
  }

  setCurrentTotalConsumption(currentTotalConsumption) {
    this._model.currentTotalConsumption = currentTotalConsumption;
  }

  getID() {
    return this._model.id;
  }

  getSiteID() {
    return this._model.siteID;
  }

  setSiteID(siteID) {
    this._model.siteID = siteID;
  }

  getSiteAreaID() {
    return this._model.siteAreaID;
  }

  setSiteAreaID(siteAreaID) {
    this._model.siteAreaID = siteAreaID;
  }

  getConnectorId() {
    return this._model.connectorId;
  }

  setConnectorId(connectorId) {
    this._model.connectorId = connectorId;
  }

  getMeterStart() {
    return this._model.meterStart;
  }

  setMeterStart(meterStart) {
    this._model.meterStart = meterStart;
  }

  getStartDate() {
    return this._model.timestamp;
  }

  setStartDate(timestamp) {
    this._model.timestamp = timestamp;
  }

  getLastUpdateDate() {
    return this._model.lastUpdate;
  }

  setLastUpdateDate(lastUpdate) {
    this._model.lastUpdate = lastUpdate;
  }

  getStartPrice() {
    return this._model.price;
  }

  setStartPrice(price) {
    this._model.price = price;
  }

  getStartRoundedPrice() {
    return this._model.roundedPrice;
  }

  setStartRoundedPrice(roundedPrice) {
    this._model.roundedPrice = roundedPrice;
  }

  getStartPriceUnit() {
    return this._model.priceUnit;
  }

  setStartPriceUnit(priceUnit) {
    this._model.priceUnit = priceUnit;
  }

  getStartPricingSource() {
    return this._model.pricingSource;
  }

  setStartPricingSource(pricingSource) {
    this._model.pricingSource = pricingSource;
  }

  getStateOfCharge() {
    return this._model.stateOfCharge;
  }

  setStateOfCharge(stateOfCharge) {
    this._model.stateOfCharge = stateOfCharge;
  }

  getTimezone() {
    return this._model.timezone;
  }

  setTimezone(timezone) {
    this._model.timezone = timezone;
  }

  getTagID() {
    return this._model.tagID;
  }

  setTagID(tagID) {
    this._model.tagID = tagID;
  }

  getUserID() {
    return this._model.userID;
  }

  setUserID(userID) {
    this._model.userID = userID;
  }

  getUserJson() {
    return this._model.user;
  }

  async getUser() {
    if (this._model.user) {
      return new User(this.getTenantID(), this._model.user);
    } else if (this._model.userID) {
      const user = await UserStorage.getUser(this.getTenantID(), this._model.userID);
      this.setUser(user);
      return user;
    }
  }

  setUser(user) {
    if (user) {
      this._model.user = user.getModel();
      this._model.userID = user.getID();
    } else {
      this._model.user = null;
    }
  }

  getStopTagID() {
    if (this.isFinished()) {
      return this._model.stop.tagID;
    }
  }

  setStopTagID(tagID) {
    this._checkAndCreateStop();
    this._model.stop.tagID = tagID;
  }

  getStopUserID() {
    if (this.isFinished()) {
      return this._model.stop.userID;
    }
  }

  setStopUserID(userID) {
    this._checkAndCreateStop();
    this._model.stop.userID = userID;
  }

  setStopUser(user) {
    this._checkAndCreateStop();
    if (user) {
      this._model.stop.user = user.getModel();
      this._model.stop.userID = user.getID();
    } else {
      this._model.stop.user = null;
    }
  }

  getStopUserJson() {
    if (this.isFinished()) {
      return this._model.stop.user;
    }
  }

  async getStopUser() {
    if (this.isFinished()) {
      if (this._model.stop.user) {
        return new User(this.getTenantID(), this._model.stop.user);
      } else if (this._model.stop.userID) {
        const user = await UserStorage.getUser(this.getTenantID(), this._model.stop.userID);
        this.setStopUser(user);
        return user;
      }
    }
  }

  getStopMeter() {
    if (this.isFinished()) {
      return this._model.stop.meterStop;
    }
  }

  setStopMeter(meterStop) {
    this._checkAndCreateStop();
    this._model.stop.meterStop = meterStop;
  }

  getChargeBoxID() {
    return this._model.chargeBoxID;
  }

  setChargeBoxID(chargeBoxID) {
    this._model.chargeBoxID = chargeBoxID;
  }

  async getChargingStation() {
    if (this._model.chargeBox) {
      return new ChargingStation(this.getTenantID(), this._model.chargeBox);
    } else if (this._model.chargeBoxID) {
      const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this._model.chargeBoxID);
      this.setChargingStation(chargingStation);
      return chargingStation;
    }
  }

  setChargingStation(chargingStation) {
    if (chargingStation) {
      this._model.chargeBox = chargingStation.getModel();
      this._model.chargeBoxID = chargingStation.getID();
    } else {
      this._model.chargeBox = null;
      this._model.chargeBoxID = null;
    }
  }

  getStopPrice() {
    if (this.isFinished()) {
      return this._model.stop.price;
    }
  }

  setStopPrice(price) {
    this._checkAndCreateStop();
    this._model.stop.price = price;
  }

  getStopRoundedPrice() {
    if (this.isFinished()) {
      return this._model.stop.roundedPrice;
    }
  }

  setStopRoundedPrice(roundedPrice) {
    this._checkAndCreateStop();
    this._model.stop.roundedPrice = roundedPrice;
  }

  getStopPriceUnit() {
    if (this.isFinished()) {
      return this._model.stop.priceUnit;
    }
  }

  setStopPriceUnit(priceUnit) {
    this._checkAndCreateStop();
    this._model.stop.priceUnit = priceUnit;
  }

  getStopPricingSource() {
    if (this.isFinished()) {
      return this._model.stop.pricingSource;
    }
  }

  setStopPricingSource(pricingSource) {
    this._checkAndCreateStop();
    this._model.stop.pricingSource = pricingSource;
  }

  hasStartPrice() {
    return this.getStartPrice() >= 0;
  }

  hasStopPrice() {
    return this.isFinished() && this.getStopPrice() >= 0;
  }

  getMeterValues() {
    return OCPPStorage.getMeterValues(this.getTenantID(), this.getID());
  }

  getStopStateOfCharge() {
    if (this.isFinished()) {
      return this._model.stop.stateOfCharge;
    }
  }

  setStopStateOfCharge(stateOfCharge) {
    this._checkAndCreateStop();
    this._model.stop.stateOfCharge = stateOfCharge;
  }

  hasMultipleConsumptions() {
    return this.getNumberOfMeterValues() > 1;
  }

  isActive() {
    return !this._model.hasOwnProperty('stop');
  }

  isFinished() {
    return this._model.hasOwnProperty('stop');
  }

  isRemotelyStopped() {
    return this._model.hasOwnProperty('remotestop');
  }

  getRemoteStop() {
    return this._model.remotestop;
  }

  setRemoteStop(remotestop) {
    this._model.remotestop = remotestop;
  }

  setRemoteStopTagID(tagID) {
    this._checkAndCreateRemoteStop();
    this._model.remotestop.tagID = tagID;
  }

  getRemoteStopTagID() {
    if (this.isRemotelyStopped()) {
      return this._model.remotestop.tagID;
    }
  }

  setRemoteStopDate(timestamp) {
    this._checkAndCreateRemoteStop();
    this._model.remotestop.timestamp = timestamp;
  }

  getRemoteStopDate() {
    if (this.isRemotelyStopped()) {
      return this._model.remotestop.timestamp;
    }
  }

  getRefundData() {
    return this._model.refundData;
  }

  setRefundData(refundData) {
    this._model.refundData = refundData;
  }

  isRefunded() {
    return this._model.refundData && !!this._model.refundData.refundId;
  }

  hasStateOfCharges() {
    return this.getStateOfCharge() > 0;
  }

  getChargerStatus() {
    if (this.isActive() && this._model.chargeBox && this._model.chargeBox.connectors) {
      for (const connector of this._model.chargeBox.connectors) {
        if (connector.connectorId === this.getConnectorId()) {
          return connector.status;
        }
      }
    }
  }

  isLoading() {
    if (this.isActive()) {
      return this.getCurrentTotalInactivitySecs() > 60;
    }
    return false;
  }

  getStopTotalInactivitySecs() {
    if (this.isFinished()) {
      return this._model.stop.totalInactivitySecs;
    }
  }

  setStopTotalInactivitySecs(totalInactivitySecs) {
    this._checkAndCreateStop();
    this._model.stop.totalInactivitySecs = totalInactivitySecs;
  }

  setStopExtraInactivitySecs(extraInactivitySecs) {
    this._checkAndCreateStop();
    this._model.stop.extraInactivitySecs = extraInactivitySecs;
  }

  getStopExtraInactivitySecs() {
    if (this.isFinished()) {
      return this._model.stop.extraInactivitySecs;
    }
  }

  getStopTotalConsumption() {
    if (this.isFinished()) {
      return this._model.stop.totalConsumption;
    }
    return 0;
  }

  setStopTotalConsumption(totalConsumption) {
    this._checkAndCreateStop();
    this._model.stop.totalConsumption = totalConsumption;
  }

  getCurrentTotalDurationSecs() {
    if (this.isActive()) {
      return moment.duration(moment(this.getLastMeterValue().timestamp).diff(moment(this.getStartDate()))).asSeconds();
    } else {
      return moment.duration(moment(this.getStopDate()).diff(moment(this.getStartDate()))).asSeconds();
    }
  }

  getStopTotalDurationSecs() {
    // Stopped already?
    if (this.isFinished()) {
      return this._model.stop.totalDurationSecs;
    }
    return 0;
  }

  setStopTotalDurationSecs(totalDurationSecs) {
    this._checkAndCreateStop();
    this._model.stop.totalDurationSecs = totalDurationSecs;
  }

  getStopDate() {
    if (this.isFinished()) {
      return this._model.stop.timestamp;
    }
  }

  setStopDate(timestamp) {
    this._checkAndCreateStop();
    this._model.stop.timestamp = timestamp;
  }

  clearRuntimeData() {
    delete this._model.currentConsumption;
    delete this._model.currentStateOfCharge;
    delete this._model.currentTotalConsumption;
    delete this._model.currentTotalInactivitySecs;
    delete this._model.currentCumulatedPrice;
    delete this._model.lastMeterValue;
    delete this._model.numberOfMeterValues;
  }

  _checkAndCreateStop() {
    if (!this._model.stop) {
      this._model.stop = {};
    }
  }

  _checkAndCreateRemoteStop() {
    if (!this._model.remotestop) {
      this._model.remotestop = {};
    }
  }

  delete() {
    return TransactionStorage.deleteTransaction(this.getTenantID(), this);
  }

  save() {
    return TransactionStorage.saveTransaction(this.getTenantID(), this.getModel());
  }

  getConsumptions() {
    return ConsumptionStorage.getConsumptions(this.getTenantID(), this.getID());
  }

  saveConsumption(consumption) {
    return ConsumptionStorage.saveConsumption(this.getTenantID(), consumption);
  }

  static getTransaction(tenantID, id) {
    return TransactionStorage.getTransaction(tenantID, id);
  }

  static getTransactions(tenantID, filter, limit) {
    return TransactionStorage.getTransactions(tenantID, filter, limit);
  }

  static getActiveTransaction(tenantID, chargeBoxID, connectorId) {
    return TransactionStorage.getActiveTransaction(tenantID, chargeBoxID, connectorId);
  }

  static getLastTransaction(tenantID, chargeBoxID, connectorId) {
    return TransactionStorage.getLastTransaction(tenantID, chargeBoxID, connectorId);
  }
}
