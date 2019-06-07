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

  private model: any = {};

  constructor(tenantID, transaction) {
    super(tenantID);
    Database.updateTransaction(transaction, this.model);
  }

  getCurrentTotalInactivitySecs() {
    return this.model.currentTotalInactivitySecs;
  }

  setCurrentTotalInactivitySecs(currentTotalInactivitySecs) {
    this.model.currentTotalInactivitySecs = currentTotalInactivitySecs;
  }

  getLastMeterValue() {
    return this.model.lastMeterValue;
  }

  setLastConsumptionMeterValue(lastMeterValue) {
    this.model.lastMeterValue = lastMeterValue;
  }

  getCurrentStateOfCharge() {
    return this.model.currentStateOfCharge;
  }

  setCurrentStateOfCharge(currentStateOfCharge) {
    this.model.currentStateOfCharge = currentStateOfCharge;
  }

  getNumberOfMeterValues() {
    return this.model.numberOfMeterValues;
  }

  setNumberOfConsumptionMeterValues(numberOfMeterValues) {
    this.model.numberOfMeterValues = numberOfMeterValues;
  }

  getCurrentConsumption() {
    return this.model.currentConsumption;
  }

  setCurrentConsumption(currentConsumption) {
    this.model.currentConsumption = currentConsumption;
  }

  setCurrentConsumptionWh(currentConsumptionWh) {
    this.model.currentConsumptionWh = currentConsumptionWh;
  }

  getCurrentConsumptionWh() {
    return this.model.currentConsumptionWh ? this.model.currentConsumptionWh : 0;
  }

  getCurrentCumulatedPrice() {
    return this.model.currentCumulatedPrice ? this.model.currentCumulatedPrice : 0;
  }

  setCurrentCumulatedPrice(currentCumulatedPrice) {
    this.model.currentCumulatedPrice = currentCumulatedPrice;
  }

  getCurrentTotalConsumption() {
    return this.model.currentTotalConsumption;
  }

  setCurrentTotalConsumption(currentTotalConsumption) {
    this.model.currentTotalConsumption = currentTotalConsumption;
  }

  getModel() {
    return this.model;
  }

  getID() {
    return this.model.id;
  }

  getSiteID() {
    return this.model.siteID;
  }

  setSiteID(siteID) {
    this.model.siteID = siteID;
  }

  getSiteAreaID() {
    return this.model.siteAreaID;
  }

  setSiteAreaID(siteAreaID) {
    this.model.siteAreaID = siteAreaID;
  }

  getConnectorId() {
    return this.model.connectorId;
  }

  setConnectorId(connectorId) {
    this.model.connectorId = connectorId;
  }

  getMeterStart() {
    return this.model.meterStart;
  }

  setMeterStart(meterStart) {
    this.model.meterStart = meterStart;
  }

  getStartDate() {
    return this.model.timestamp;
  }

  setStartDate(timestamp) {
    this.model.timestamp = timestamp;
  }

  getLastUpdateDate() {
    return this.model.lastUpdate;
  }

  setLastUpdateDate(lastUpdate) {
    this.model.lastUpdate = lastUpdate;
  }

  getStartPrice() {
    return this.model.price;
  }

  setStartPrice(price) {
    this.model.price = price;
  }

  getStartRoundedPrice() {
    return this.model.roundedPrice;
  }

  setStartRoundedPrice(roundedPrice) {
    this.model.roundedPrice = roundedPrice;
  }

  getStartPriceUnit() {
    return this.model.priceUnit;
  }

  setStartPriceUnit(priceUnit) {
    this.model.priceUnit = priceUnit;
  }

  getStartPricingSource() {
    return this.model.pricingSource;
  }

  setStartPricingSource(pricingSource) {
    this.model.pricingSource = pricingSource;
  }

  getStateOfCharge() {
    return this.model.stateOfCharge;
  }

  setStateOfCharge(stateOfCharge) {
    this.model.stateOfCharge = stateOfCharge;
  }

  getTimezone() {
    return this.model.timezone;
  }

  setTimezone(timezone) {
    this.model.timezone = timezone;
  }

  getTagID() {
    return this.model.tagID;
  }

  setTagID(tagID) {
    this.model.tagID = tagID;
  }

  getUserID() {
    return this.model.userID;
  }

  setUserID(userID) {
    this.model.userID = userID;
  }

  getUserJson() {
    return this.model.user;
  }

  async getUser() {
    if (this.model.user) {
      return new User(this.getTenantID(), this.model.user);
    } else if (this.model.userID) {
      // Get from DB
      const user = await UserStorage.getUser(this.getTenantID(), this.model.userID);
      // Keep it
      this.setUser(user);
      return user;
    }
  }

  setUser(user) {
    if (user) {
      this.model.user = user.getModel();
      this.model.userID = user.getID();
    } else {
      this.model.user = null;
    }
  }

  getStopTagID() {
    if (this.isFinished()) {
      return this.model.stop.tagID;
    }
  }

  setStopTagID(tagID) {
    this._checkAndCreateStop();
    this.model.stop.tagID = tagID;
  }

  getStopUserID() {
    if (this.isFinished()) {
      return this.model.stop.userID;
    }
  }

  setStopUserID(userID) {
    this._checkAndCreateStop();
    this.model.stop.userID = userID;
  }

  setStopUser(user) {
    this._checkAndCreateStop();
    if (user) {
      this.model.stop.user = user.getModel();
      this.model.stop.userID = user.getID();
    } else {
      this.model.stop.user = null;
    }
  }

  getStopUserJson() {
    if (this.isFinished()) {
      return this.model.stop.user;
    }
  }

  async getStopUser() {
    if (this.isFinished()) {
      if (this.model.stop.user) {
        return new User(this.getTenantID(), this.model.stop.user);
      } else if (this.model.stop.userID) {
        // Get from DB
        const user = await UserStorage.getUser(this.getTenantID(), this.model.stop.userID);
        // Keep it
        this.setStopUser(user);
        return user;
      }
    }
  }

  getStopMeter() {
    if (this.isFinished()) {
      return this.model.stop.meterStop;
    }
  }

  setStopMeter(meterStop) {
    this._checkAndCreateStop();
    this.model.stop.meterStop = meterStop;
  }

  getChargeBoxID() {
    return this.model.chargeBoxID;
  }

  setChargeBoxID(chargeBoxID) {
    this.model.chargeBoxID = chargeBoxID;
  }

  async getChargingStation() {
    if (this.model.chargeBox) {
      return new ChargingStation(this.getTenantID(), this.model.chargeBox);
    } else if (this.model.chargeBoxID) {
      // Get from DB
      const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.model.chargeBoxID);
      // Keep it
      this.setChargingStation(chargingStation);
      // Return
      return chargingStation;
    }
  }

  setChargingStation(chargingStation) {
    if (chargingStation) {
      this.model.chargeBox = chargingStation.getModel();
      this.model.chargeBoxID = chargingStation.getID();
    } else {
      this.model.chargeBox = null;
      this.model.chargeBoxID = null;
    }
  }

  getStopPrice() {
    if (this.isFinished()) {
      return this.model.stop.price;
    }
  }

  setStopPrice(price) {
    this._checkAndCreateStop();
    this.model.stop.price = price;
  }

  getStopRoundedPrice() {
    if (this.isFinished()) {
      return this.model.stop.roundedPrice;
    }
  }

  setStopRoundedPrice(roundedPrice) {
    this._checkAndCreateStop();
    this.model.stop.roundedPrice = roundedPrice;
  }

  getStopPriceUnit() {
    if (this.isFinished()) {
      return this.model.stop.priceUnit;
    }
  }

  setStopPriceUnit(priceUnit) {
    this._checkAndCreateStop();
    this.model.stop.priceUnit = priceUnit;
  }

  getStopPricingSource() {
    if (this.isFinished()) {
      return this.model.stop.pricingSource;
    }
  }

  setStopPricingSource(pricingSource) {
    this._checkAndCreateStop();
    this.model.stop.pricingSource = pricingSource;
  }

  hasStartPrice() {
    return this.getStartPrice() >= 0;
  }

  hasStopPrice() {
    return this.isFinished() && this.getStopPrice() >= 0;
  }

  getMeterValues() {
    // Get Meter Values
    return OCPPStorage.getMeterValues(this.getTenantID(), this.getID());
  }

  getStopStateOfCharge() {
    if (this.isFinished()) {
      return this.model.stop.stateOfCharge;
    }
  }

  setStopStateOfCharge(stateOfCharge) {
    this._checkAndCreateStop();
    this.model.stop.stateOfCharge = stateOfCharge;
  }

  hasMultipleConsumptions() {
    return this.getNumberOfMeterValues() > 1;
  }

  isActive() {
    return !this.model.hasOwnProperty('stop');
  }

  isFinished() {
    return this.model.hasOwnProperty('stop');
  }

  isRemotelyStopped() {
    return this.model.hasOwnProperty('remotestop');
  }

  getRemoteStop() {
    return this.model.remotestop;
  }

  setRemoteStop(remotestop) {
    this.model.remotestop = remotestop;
  }

  setRemoteStopTagID(tagID) {
    this._checkAndCreateRemoteStop();
    this.model.remotestop.tagID = tagID;
  }

  getRemoteStopTagID() {
    if (this.isRemotelyStopped()) {
      return this.model.remotestop.tagID;
    }
  }

  setRemoteStopDate(timestamp) {
    this._checkAndCreateRemoteStop();
    this.model.remotestop.timestamp = timestamp;
  }

  getRemoteStopDate() {
    if (this.isRemotelyStopped()) {
      return this.model.remotestop.timestamp;
    }
  }

  getRefundData() {
    return this.model.refundData;
  }

  setRefundData(refundData) {
    this.model.refundData = refundData;
  }

  isRefunded() {
    return this.model.refundData && !!this.model.refundData.refundId;
  }

  hasStateOfCharges() {
    return this.getStateOfCharge() > 0;
  }

  getChargerStatus() {
    if (this.isActive() && this.model.chargeBox && this.model.chargeBox.connectors) {
      for (const connector of this.model.chargeBox.connectors) {
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
      return this.model.stop.totalInactivitySecs;
    }
  }

  setStopTotalInactivitySecs(totalInactivitySecs) {
    this._checkAndCreateStop();
    this.model.stop.totalInactivitySecs = totalInactivitySecs;
  }

  setStopExtraInactivitySecs(extraInactivitySecs) {
    this._checkAndCreateStop();
    this.model.stop.extraInactivitySecs = extraInactivitySecs;
  }

  getStopExtraInactivitySecs() {
    if (this.isFinished()) {
      return this.model.stop.extraInactivitySecs;
    }
  }

  getStopTotalConsumption() {
    if (this.isFinished()) {
      return this.model.stop.totalConsumption;
    }
    return 0;
  }

  setStopTotalConsumption(totalConsumption) {
    this._checkAndCreateStop();
    this.model.stop.totalConsumption = totalConsumption;
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
      return this.model.stop.totalDurationSecs;
    }
    return 0;
  }

  setStopTotalDurationSecs(totalDurationSecs) {
    this._checkAndCreateStop();
    this.model.stop.totalDurationSecs = totalDurationSecs;
  }

  getStopDate() {
    if (this.isFinished()) {
      return this.model.stop.timestamp;
    }
  }

  setStopDate(timestamp) {
    this._checkAndCreateStop();
    this.model.stop.timestamp = timestamp;
  }

  clearRuntimeData() {
    delete this.model.currentConsumption;
    delete this.model.currentStateOfCharge;
    delete this.model.currentTotalConsumption;
    delete this.model.currentTotalInactivitySecs;
    delete this.model.currentCumulatedPrice;
    delete this.model.lastMeterValue;
    delete this.model.numberOfMeterValues;
  }

  _checkAndCreateStop() {
    if (!this.model.stop) {
      this.model.stop = {};
    }
  }

  _checkAndCreateRemoteStop() {
    if (!this.model.remotestop) {
      this.model.remotestop = {};
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
