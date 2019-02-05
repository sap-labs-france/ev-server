const moment = require('moment');
const Database = require('../utils/Database');
const Utils = require('../utils/Utils');
const AbstractTenantEntity = require('./AbstractTenantEntity');
const UserStorage = require('../storage/mongodb/UserStorage');
const PricingStorage = require('../storage/mongodb/PricingStorage');

const DEFAULT_CONSUMPTION_ATTRIBUTE = {
  unit: 'Wh',
  location: 'Outlet',
  measurand: 'Energy.Active.Import.Register',
  format: 'Raw',
  context: 'Sample.Periodic'
};

class Transaction extends AbstractTenantEntity {

  constructor(tenantID, transaction) {
    super(tenantID);
    this._model = {};
    if (transaction) {
      Database.updateTransaction(transaction, this._model);
    }
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

  setLastMeterValue(lastMeterValue) {
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

  setNumberOfMeterValues(numberOfMeterValues) {
    this._model.numberOfMeterValues = numberOfMeterValues;
  }

  getCurrentConsumption() {
    return this._model.currentConsumption;
  }

  setCurrentConsumption(currentConsumption) {
    this._model.currentConsumption = currentConsumption;
  }

  getCurrentTotalConsumption() {
    return this._model.currentTotalConsumption;
  }

  setCurrentTotalConsumption(currentTotalConsumption) {
    this._model.currentTotalConsumption = currentTotalConsumption;
  }

  getTotalInactivitySecs() {
    if (this.isFinished()) {
      return this._model.stop.totalInactivitySecs
    }
  }

  getTotalConsumption() {
    if (this.isFinished()) {
      return this._model.stop.totalConsumption;
    }
    return 0;
  }

  getCurrentTotalDurationSecs() {
    // Stopped already?
    const lastMeterValue = this.getLastMeterValue();
    if (lastMeterValue) {
      return moment.duration(moment(lastMeterValue.timestamp).diff(moment(this.getStartDate()))).asSeconds();
    }
    return 0;
  }

  getTotalDurationSecs() {
    // Stopped already?
    if (this.isFinished()) {
      return this._model.stop.totalDurationSecs;
    }
    return 0;
  }

  getModel() {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  getChargeBoxID() {
    return this._model.chargeBoxID;
  }

  getConnectorId() {
    return this._model.connectorId;
  }

  getMeterStart() {
    return this._model.meterStart;
  }

  getStartDate() {
    return this._model.timestamp;
  }

  getEndDate() {
    if (this.isFinished()) {
      return this._model.stop.timestamp;
    }
  }

  getTagID() {
    return this._model.tagID;
  }

  getUserID() {
    return this._model.userID;
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

  getUserJson() {
    return this._model.user;
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

  getStoppedUserID() {
    if (this.isFinished()) {
      return this._model.stop.userID;
    }
  }

  setStoppedUser(user) {
    if (this.isFinished()) {
      if (user) {
        this._model.stop.user = user.getModel();
        this._model.stop.userID = user.getID();
      } else {
        this._model.stop.user = null;
      }
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

  getStoppedUserJson() {
    if (this.isFinished()) {
      return this._model.stop.user;
    }
  }

  getMeterStop() {
    if (this.isFinished()) {
      return this._model.stop.meterStop;
    }
  }

  getChargingStation() {
    return this._model.chargeBox;
  }

  getPriceUnit() {
    if (this.isFinished()) {
      return this._model.stop.priceUnit;
    }
  }

  getPrice() {
    if (this.isFinished()) {
      return this._model.stop.price;
    }
  }

  hasPrice() {
    return this.isFinished() && this.getPrice() >= 0;
  }

  async getConsumptions() {
    let firstMeterValue = false;
    let lastMeterValue;
    let cumulatedConsumption = 0;
    const consumptions = [];
    // Get Meter Values
    let meterValues = await this.getMeterValues();
    // Add first Meter Value
    meterValues.splice(0, 0, {
      id: '666',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: this.getStartDate(),
      value: this.getMeterStart(),
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    });
    // Add last Meter Value
    if (this.isFinished()) {
      // Add the missing Meter Value
      meterValues.push({
        id: '6969',
        connectorId: this.getConnectorId(),
        transactionId: this.getID(),
        timestamp: this.getEndDate(),
        value: this.getMeterStop(),
        attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
      });
    }
    // Build the model
    for (let meterValueIndex = 0; meterValueIndex < meterValues.length; meterValueIndex++) {
      const meterValue = meterValues[meterValueIndex];
      // Meter Value Consumption?
      if (this.isConsumptionMeterValue(meterValue)) {
        // First value?
        if (!firstMeterValue) {
          // No: Keep the first value
          lastMeterValue = meterValue;
          // Ok
          firstMeterValue = true;
          // Calculate the consumption with the last value provided
        } else {
          // Last value is > ?
          if (lastMeterValue.value > meterValue.value) {
            // Yes: reinit it (the value has started over from 0)
            lastMeterValue.value = 0;
          }
          // Get the diff
          const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 's');
          // Sample multiplier
          const sampleMultiplier = 3600 / diffSecs;
          // Consumption
          const consumptionWh = meterValue.value - lastMeterValue.value;
          // compute
          const currentConsumption = consumptionWh * sampleMultiplier;
          // Set cumulated
          cumulatedConsumption += consumptionWh;
          // Check last Meter Value
          if (consumptions.length > 0 &&
            consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
            // Same timestamp: Update the latest
            consumptions[consumptions.length - 1].value = currentConsumption;
            consumptions[consumptions.length - 1].cumulated = cumulatedConsumption;
          } else {
            // Add the consumption
            consumptions.push({
              date: meterValue.timestamp,
              value: currentConsumption,
              cumulated: cumulatedConsumption,
              stateOfCharge: 0
            });
          }
          lastMeterValue = meterValue;
        }
        // Meter Value State of Charge?
      } else if (this.isSocMeterValue(meterValue)) {
        // Set the last SoC
        consumptions.stateOfCharge = meterValue.value;
        // Check last Meter Value
        if (consumptions.length > 0 &&
          consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
          // Same timestamp: Update the latest
          consumptions[consumptions.length - 1].stateOfCharge = meterValue.value;
        } else {
          // Add the consumption
          consumptions.push({
            date: meterValue.timestamp,
            stateOfCharge: meterValue.value,
            value: 0,
            cumulated: 0
          });
        }
      }
    }
    return consumptions;
  }

  getMeterValues() {
    const TransactionStorage = require('../storage/mongodb/TransactionStorage');
    // Get Meter Values
    return TransactionStorage.getMeterValues(this.getTenantID(), this.getID());
  }

  getStateOfCharge() {
    return this._model.stateOfCharge;
  }

  setStateOfCharge(stateOfCharge) {
    this._model.stateOfCharge = stateOfCharge;
  }

  getEndStateOfCharge() {
    if (this.isFinished()) {
      return this._model.stop.stateOfCharge;
    }
  }

  isSocMeterValue(meterValue) {
    return meterValue.attribute
      && (meterValue.attribute.context === 'Sample.Periodic'
        || meterValue.attribute.context === 'Transaction.Begin'
        || meterValue.attribute.context === 'Transaction.End')
      && meterValue.attribute.measurand === 'SoC'
  }

  isConsumptionMeterValue(meterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"));
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

  getRefundData() {
    return this._model.refundData;
  }

  isRefunded() {
    return this._model.refundData && !!this._model.refundData.refundId;
  }

  setRefundData(refundData) {
    this._model.refundData = refundData;
  }

  async startTransaction(user) {
    // Init
    this.setNumberOfMeterValues(0);
    this.setLastMeterValue({value: this.getMeterStart(), timestamp: this.getStartDate()})
    this.setCurrentTotalInactivitySecs(0);
    this.setCurrentStateOfCharge(0);
    this.setStateOfCharge(0);
    this.setCurrentConsumption(0);
    this.setCurrentTotalConsumption(0);
    this.setUser(user);
  }

  async updateWithMeterValue(meterValue) {
    // State of Charge?
    if (this.isSocMeterValue(meterValue)) {
      // Check for first SoC
      if (this.getStateOfCharge() === 0) {
        // Set First
        this.setStateOfCharge(meterValue.value);
      }
      // Set current
      this.setCurrentStateOfCharge(meterValue.value);
      // Consumption?
    } else if (this.isConsumptionMeterValue(meterValue)) {
      // Get the last one
      const lastMeterValue = this.getLastMeterValue();
      // Update
      this.setNumberOfMeterValues(this.getNumberOfMeterValues() + 1);
      this.setLastMeterValue({
        value: Utils.convertToInt(meterValue.value),
        timestamp: Utils.convertToDate(meterValue.timestamp).toISOString()
      })
      // Compute duration
      const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
      // Check if the new value is greater
      if (Utils.convertToInt(meterValue.value) >= lastMeterValue.value) {
        // Compute consumption
        const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
        const consumption = meterValue.value - lastMeterValue.value;
        const currentConsumption = consumption * sampleMultiplier;
        // Update current consumption
        this.setCurrentConsumption(currentConsumption);
        this.setCurrentTotalConsumption(this.getCurrentTotalConsumption() + consumption);
        // Inactivity?
        if (consumption === 0) {
          this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
        }
      } else {
        // Update current consumption
        this.setCurrentConsumption(0);
        this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
      }
    }
  }

  async stopTransaction(userID, tagId, meterStop, timestamp) {
    // Create Stop
    this._model.stop = {};
    this._model.stop.meterStop = meterStop;
    this._model.stop.timestamp = timestamp;
    this._model.stop.userID = userID;
    this._model.stop.tagID = tagId;
    this._model.stop.stateOfCharge = this.getCurrentStateOfCharge();
    // Get the last one
    const lastMeterValue = this.getLastMeterValue();
    // Compute duration
    const diffSecs = moment(timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
    // Check if the new value is greater
    if (Utils.convertToInt(meterStop) >= lastMeterValue.value) {
      // Compute consumption
      const consumption = meterStop - lastMeterValue.value;
      // Update current consumption
      this.setCurrentTotalConsumption(this.getCurrentTotalConsumption() + consumption);
      // Inactivity?
      if (consumption === 0) {
        this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
      }
    } else {
      // Update current consumption
      this.setCurrentConsumption(0);
      this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
    }
    // Set Total data
    this._model.stop.totalConsumption = this.getCurrentTotalConsumption();
    this._model.stop.totalInactivitySecs = this.getCurrentTotalInactivitySecs();
    this._model.stop.totalDurationSecs = Math.round(moment.duration(moment(timestamp).diff(moment(this.getStartDate()))).asSeconds());
    // No Duration?
    if (this._model.stop.totalDurationSecs === 0) {
      // Compute it from now
      this._model.stop.totalDurationSecs = Math.round(moment.duration(moment().diff(moment(this.getStartDate()))).asSeconds());
      this._model.stop.totalInactivitySecs = this._model.stop.totalDurationSecs;
    }
    // Get the price
    const pricing = await PricingStorage.getPricing(this.getTenantID());
    // Set
    this._model.stop.priceUnit = pricing.priceUnit;
    this._model.stop.price = pricing.priceKWH * (this.getCurrentTotalConsumption() / 1000);
    // Remove runtime data
    delete this._model.currentConsumption;
    delete this._model.currentStateOfCharge;
    delete this._model.currentTotalConsumption;
    delete this._model.currentTotalInactivitySecs;
    delete this._model.lastMeterValue;
    delete this._model.numberOfMeterValues;
  }

  remoteStop(tagId, timestamp) {
    this._model.remotestop = {};
    this._model.remotestop.tagID = tagId;
    this._model.remotestop.timestamp = timestamp;
  }

  hasStateOfCharges() {
    return this.getStateOfCharge() > 0;
  }

  getChargerStatus() {
    if (this.isActive() && this._model.chargeBox) {
      return this._model.chargeBox.connectors[this.getConnectorId() - 1].status;
    }
  }

  isLoading() {
    if (this.isActive()) {
      return this.getCurrentTotalInactivitySecs() > 60;
    }
    return false;
  }
}

module.exports = Transaction;