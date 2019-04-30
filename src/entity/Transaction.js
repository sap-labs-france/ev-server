const moment = require('moment');
const Database = require('../utils/Database');
const AbstractTenantEntity = require('./AbstractTenantEntity');
const UserStorage = require('../storage/mongodb/UserStorage');
const ConsumptionStorage = require('../storage/mongodb/ConsumptionStorage');
const TransactionStorage = require('../storage/mongodb/TransactionStorage');
const OCPPStorage = require('../storage/mongodb/OCPPStorage');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');

class Transaction extends AbstractTenantEntity {
  constructor(tenantID, transaction) {
    super(tenantID);
    Database.updateTransaction(transaction, this._model);
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

  getModel() {
    return this._model;
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
    const User = require('./User');
    if (this._model.user) {
      return new User(this.getTenantID(), this._model.user);
    } else if (this._model.userID) {
      // Get from DB
      const user = await UserStorage.getUser(this.getTenantID(), this._model.userID);
      // Keep it
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

  getStoppedTagID() {
    if (this.isFinished()) {
      return this._model.stop.tagID;
    }
  }

  setStoppedTagID(tagID) {
    this._checkAndCreateStop();
    this._model.stop.tagID = tagID;
  }

  getStoppedUserID() {
    if (this.isFinished()) {
      return this._model.stop.userID;
    }
  }

  setStoppedUserID(userID) {
    this._checkAndCreateStop();
    this._model.stop.userID = userID;
  }

  setStoppedUser(user) {
    this._checkAndCreateStop();
    if (user) {
      this._model.stop.user = user.getModel();
      this._model.stop.userID = user.getID();
    } else {
      this._model.stop.user = null;
    }
  }

  getStoppedUserJson() {
    if (this.isFinished()) {
      return this._model.stop.user;
    }
  }

  async getStoppedUser() {
    const User = require('./User');
    if (this.isFinished()) {
      if (this._model.stop.user) {
        return new User(this.getTenantID(), this._model.stop.user);
      } else if (this._model.stop.userID) {
        // Get from DB
        const user = await UserStorage.getUser(this.getTenantID(), this._model.stop.userID);
        // Keep it
        this.setStoppedUser(user);
        return user;
      }
    }
  }

  getMeterStop() {
    if (this.isFinished()) {
      return this._model.stop.meterStop;
    }
  }

  setMeterStop(meterStop) {
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
    const ChargingStation = require('./ChargingStation');
    if (this._model.chargeBox) {
      return new ChargingStation(this.getTenantID(), this._model.chargeBox);
    } else if (this._model.chargeBoxID) {
      // Get from DB
      const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this._model.chargeBoxID);
      // Keep it
      this.setChargingStation(chargingStation);
      // Return
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

  getPrice() {
    if (this.isFinished()) {
      return this._model.stop.price;
    }
  }

  setPrice(price) {
    this._checkAndCreateStop();
    this._model.stop.price = price;
  }

  getRoundedPrice() {
    if (this.isFinished()) {
      return this._model.stop.roundedPrice;
    }
  }

  setRoundedPrice(roundedPrice) {
    this._checkAndCreateStop();
    this._model.stop.roundedPrice = roundedPrice;
  }

  getPriceUnit() {
    if (this.isFinished()) {
      return this._model.stop.priceUnit;
    }
  }

  setPriceUnit(priceUnit) {
    this._checkAndCreateStop();
    this._model.stop.priceUnit = priceUnit;
  }

  getPricingSource() {
    if (this.isFinished()) {
      return this._model.stop.pricingSource;
    }
  }

  setPricingSource(pricingSource) {
    this._checkAndCreateStop();
    this._model.stop.pricingSource = pricingSource;
  }

  hasPrice() {
    return this.isFinished() && this.getPrice() >= 0;
  }

  getMeterValues() {
    // Get Meter Values
    return OCPPStorage.getMeterValues(this.getTenantID(), this.getID());
  }

  getEndStateOfCharge() {
    if (this.isFinished()) {
      return this._model.stop.stateOfCharge;
    }
  }

  setEndStateOfCharge(stateOfCharge) {
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

  getTotalInactivitySecs() {
    if (this.isFinished()) {
      return this._model.stop.totalInactivitySecs;
    }
  }

  setTotalInactivitySecs(totalInactivitySecs) {
    this._checkAndCreateStop();
    this._model.stop.totalInactivitySecs = totalInactivitySecs;
  }

  getTotalConsumption() {
    if (this.isFinished()) {
      return this._model.stop.totalConsumption;
    }
    return 0;
  }

  setTotalConsumption(totalConsumption) {
    this._checkAndCreateStop();
    this._model.stop.totalConsumption = totalConsumption;
  }

  getCurrentTotalDurationSecs() {
    // Stopped already?
    return moment.duration(moment(new Date()).diff(moment(this.getStartDate()))).asSeconds();
  }

  getTotalDurationSecs() {
    // Stopped already?
    if (this.isFinished()) {
      return this._model.stop.totalDurationSecs;
    }
    return 0;
  }

  setTotalDurationSecs(totalDurationSecs) {
    this._checkAndCreateStop();
    this._model.stop.totalDurationSecs = totalDurationSecs;
  }

  getEndDate() {
    if (this.isFinished()) {
      return this._model.stop.timestamp;
    }
  }

  setEndDate(timestamp) {
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
}

module.exports = Transaction;