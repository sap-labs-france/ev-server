const moment = require('moment');
const Utils = require('../utils/Utils');
const Database = require('../utils/Database');
const AbstractTenantEntity = require('./AbstractTenantEntity');

class Transaction extends AbstractTenantEntity {

  constructor(tenantID, transaction) {
    super(tenantID);
    this._model = {};
    this._model.meterValues = [];
    if (transaction) {
      Database.updateTransaction(transaction, this._model);
    }
    if (!this._model.internalMeterValues) {
      this._model.internalMeterValues = [];
    }
    if (this._model.user) {
      delete this._model.user.address;
      delete this._model.user.deleted;
      delete this._model.user.verificationToken;
    }
    if (this._model.stop && this._model.stop.user) {
      delete this._model.stop.user.address;
      delete this._model.stop.user.deleted;
      delete this._model.stop.user.verificationToken;
    }
    this.active = !this._model.stop;
  }

  _getLatestStateOfCharge() {
    return this.getStateOfCharges()[this.getStateOfCharges().length - 1];
  }

  _getFirstMeterValue() {
    const attribute = {
      unit: 'Wh',
      location: 'Outlet',
      measurand: 'Energy.Active.Import.Register',
      format: 'Raw',
      context: 'Sample.Periodic'
    };
    return {
      id: '666',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: this.getStartDate(),
      value: this.getMeterStart(),
      attribute: attribute
    };
  }

  _getLastMeterValue() {
    const attribute = {
      unit: 'Wh',
      location: 'Outlet',
      measurand: 'Energy.Active.Import.Register',
      format: 'Raw',
      context: 'Sample.Periodic'
    };
    return {
      id: '6969',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: this.getEndDate(),
      value: this.getMeterStop(),
      attribute: attribute
    };
  }

  _getPricing() {
    if (this._hasPricing()) {
      return this._model.pricing;
    }
    return undefined;
  }

  getModel() {
    if (this.isActive()) {
      this._model.totalConsumption = this.getTotalConsumption();
      this._model.currentConsumption = this.getCurrentConsumption();
      if (this.hasStateOfCharges()) {
        this._model.stateOfCharge = this.getStateOfCharge();
      }
    }
    if (this._hasPricing()) {
      this._model.priceUnit = this._model.pricing.priceUnit;
      this._model.price = this.getPrice();
    }
    if (this._model.user) {
      this._model.userID = this._model.user.id;
    }
    if (this._model.stop && this._model.stop.user) {
      this._model.stop.userID = this._model.stop.user.id;
    }

    const copy = Utils.duplicateJSON(this._model);
    delete copy.meterValues;
    delete copy.internalMeterValues;
    delete copy.pricing;
    return copy;
  }

  getFullModel() {
    const model = this.getModel();
    if (this._model.stop) {
      this._model.stop.user = Utils.duplicateJSON(this._model.stop.user);
    }
    model.user = Utils.duplicateJSON(this._model.user);
    model.meterValues = Utils.duplicateJSON(this._model.meterValues);
    model.pricing = Utils.duplicateJSON(this._model.pricing);
    return model;
  }

  getChargerStatus() {
    if (this.isActive() && this._model.chargeBox) {
      return this._model.chargeBox.connectors[this.getConnectorId() - 1].status;
    }
    return undefined;
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

  getTagID() {
    return this._model.tagID;
  }

  getStartDate() {
    return this._model.timestamp;
  }

  getEndDate() {
    if (!this._model.stop) {
      return undefined;
    }
    return this._model.stop.timestamp;
  }

  getUser() {
    if (this._model.user) {
      return this._model.user;
    }
    return null;
  }

  getUserID() {
    return this._model.userID;
  }

  getFinisher() {
    if (!this._model.stop) {
      return undefined;
    }
    return this._model.stop.user;
  }

  getFinisherTagId() {
    if (!this._model.stop) {
      return undefined;
    }
    return this._model.stop.tagID;
  }

  getMeterStop() {
    if (!this._model.stop) {
      return undefined;
    }
    return this._model.stop.meterStop;
  }

  _hasMeterStop() {
    if (!this._model.stop) {
      return false;
    }
    return this._model.stop.hasOwnProperty('meterStop');
  }

  getTotalConsumption() {
    if (!this.isActive()) {
      return this._model.stop.totalConsumption
    }
    if (this._hasConsumptions()) {
      return Math.floor(this._getLatestConsumption().cumulated);
    }
    return 0;
  }

  getChargeBox() {
    return this._model.chargeBox;
  }

  getTotalDurationSecs() {
    return moment.duration(moment(this._getLastUpdateDate()).diff(this.getStartDate())).asSeconds()
  }

  getTotalInactivitySecs() {
    if (!this.isActive()) {
      return this._model.stop.totalInactivitySecs
    }
    let totalInactivitySecs = 0;
    this.getConsumptions().forEach((consumption, index, array) => {
      if (index === 0) {
        return;
      }
      const lastConsumption = array[index - 1];
      if (consumption.value === 0 && lastConsumption.value === 0) {
        totalInactivitySecs += moment.duration(moment(consumption.date).diff(lastConsumption.date)).asSeconds();
      }
    });
    return totalInactivitySecs;
  }

  getPrice() {
    const price = this.getConsumptions().map(consumption => consumption.price).reduce((totalPrice, price) => totalPrice + price, 0);
    return isNaN(price) ? 0 : +(price.toFixed(6));
  }

  getPriceUnit() {
    if (this._hasPricing()) {
      return this._model.pricing.priceUnit;
    }
    return undefined;
  }

  _getLastUpdateDate() {
    return this._getLatestMeterValue().timestamp;
  }

  getDuration() {
    if (!this.isActive()) {
      moment.duration(moment(this.getEndDate()).diff(moment(this.getStartDate())));
    }
    return moment.duration(moment(this._getLastUpdateDate()).diff(moment(this.getStartDate())));
  }

  getCurrentConsumption() {
    if (this.isActive() && this._hasConsumptions()) {
      return Math.floor(this._getLatestConsumption().value);
    }
    return 0;
  }

  getConsumptions() {
    if (!this._consumptions) {
      this._consumptions = this._computeConsumptions();
    }
    return this._consumptions;
  }

  getStateOfCharges() {
    if (!this._stateOfCharges) {
      this._stateOfCharges = this._computeStateOfCharges();
    }
    return this._stateOfCharges;
  }

  isLoading() {
    if (this.isActive()) {
      return this.getAverageConsumptionOnLast(2) > 0;
    }
    return false;
  }

  _getLatestMeterValue() {
    return this.getMeterValues()[this.getMeterValues().length - 1];
  }

  _getLatestConsumption() {
    return this.getConsumptions()[this.getConsumptions().length - 1];
  }

  getMeterValues() {
    if (!this._meterValues) {
      this._meterValues = this._computeMeterValues();
    }
    return this._meterValues;
  }

  getStateOfCharge() {
    if (this.hasStateOfCharges()) {
      if (this.isActive()) {
        return this._getLatestStateOfCharge().value;
      }
      return this.getStateOfCharges()[0].value;
    }
    return undefined;
  }

  getEndStateOfCharge() {
    if (!this._model.stop) {
      return undefined;
    }
    return this._model.stop.stateOfCharge;
  }

  _computeStateOfCharges() {
    return this._getMeterValues(this._isSocMeterValue);
  }

  _isSocMeterValue(meterValue) {
    return meterValue.attribute
      && (meterValue.attribute.context === 'Sample.Periodic'
        || meterValue.attribute.context === 'Transaction.Begin'
        || meterValue.attribute.context === 'Transaction.End')
      && meterValue.attribute.measurand === 'SoC'
  }

  _isConsumptionMeterValue(meterValue) {
    return meterValue.attribute
      && meterValue.attribute.measurand === 'Energy.Active.Import.Register'
      && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock")
  }

  _computeConsumptions() {
    const consumptions = [];
    this.getMeterValues().forEach((meterValue, index, array) => {
      if (index === 0) {
        return;
      }
      consumptions.push(this._aggregateAsConsumption(array[index - 1], meterValue));
    });
    return consumptions;
  }

  _computeMeterValues() {
    const meterValues = this._getMeterValues(this._isConsumptionMeterValue);
    return this._alignMeterValues(meterValues);
  }

  _getMeterValues(typeFunction) {
    let meterValues;
    if (this._model.meterValues.length > 0) {
      meterValues = [this._getFirstMeterValue(), ...(this._model.meterValues)];
    } else {
      meterValues = [this._getFirstMeterValue(), ...(this._model.internalMeterValues)];
    }
    if (this._hasMeterStop()) {
      meterValues.push(this._getLastMeterValue());
    }

    return meterValues
      .filter(typeFunction)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  _alignMeterValues(meterValues) {
    let delta = 0;
    meterValues.forEach((meterValue, index) => {
      if (index === 0) {
        meterValue.registeredValue = meterValue.value;
        return;
      }
      const previousMeterValue = meterValues[index - 1];
      if (previousMeterValue.registeredValue > meterValue.value) {
        delta = previousMeterValue.value;
      }
      if (!meterValue.registeredValue) {
        meterValue.registeredValue = meterValue.value;
      }
      meterValue.value = +meterValue.value + delta;
    });
    return meterValues;
  }


  _invalidateComputations() {
    delete this._meterValues;
    delete this._consumptions;
    delete this._stateOfCharges;
  }

  hasMultipleConsumptions() {
    return this.getConsumptions().length > 1;
  }

  getAverageConsumptionOnLast(numberOfConsumptions) {
    if (numberOfConsumptions > this.getConsumptions().length) {
      return 1;
    }
    let cumulatedConsumption = 0;
    for (let i = this.getConsumptions().length - numberOfConsumptions; i < this.getConsumptions().length; i++) {
      cumulatedConsumption += this.getConsumptions()[i].value;
    }
    return cumulatedConsumption / numberOfConsumptions;
  }

  isActive() {
    return this.active;
  }

  isRemotelyStopped() {
    return !!this._model.remotestop;
  }

  stopTransaction(user, tagId, meterStop, timestamp) {
    this._model.stop = {};
    this._model.stop.meterStop = meterStop;
    this._model.stop.timestamp = timestamp;
    this._model.stop.user = user;
    this._model.stop.tagID = tagId;
    this._invalidateComputations();
    if (this.hasStateOfCharges()) {
      this._model.stateOfCharge = this.getStateOfCharges()[0].value;
      this._model.stop.stateOfCharge = this._getLatestStateOfCharge();
    }
    if (this._hasPricing()) {
      this._model.priceUnit = this._model.pricing.priceUnit;
      this._model.price = this.getPrice();
    }
    this._model.stop.totalConsumption = this.getTotalConsumption();
    this._model.stop.totalInactivitySecs = this.getTotalInactivitySecs();
    this._model.stop.totalDurationSecs = this.getTotalDurationSecs();
    this.active = false;
  }

  updateWithMeterValue(meterValue) {
    if (this._isConsumptionMeterValue(meterValue)) {
      this.updateInternalMeterValue(meterValue, this._isConsumptionMeterValue);
    }
    this._invalidateComputations();
  }

  updateInternalMeterValue(newMeterValue, condition) {
    const oldMeterValue = this.popInternalMeterValue(condition);
    const meterValues = [this._getFirstMeterValue(), newMeterValue];
    if (oldMeterValue) {
      meterValues.splice(1, 0, oldMeterValue);
    }
    const alignedMeterValue = this._alignMeterValues(meterValues).pop();
    this._model.internalMeterValues.push(alignedMeterValue);
  }

  popInternalMeterValue(condition) {
    const index = this._model.internalMeterValues.findIndex(condition);
    const count = this._model.internalMeterValues.reduce((count, currentValue) => condition(currentValue) ? count + 1 : count, 0);
    const value = this._model.internalMeterValues[index];
    if (count > 1) {
      this._model.internalMeterValues.splice(index, 1);
    }
    return value;
  }


  remoteStop(tagId, timestamp) {
    this._model.remotestop = {};
    this._model.remotestop.tagID = tagId;
    this._model.remotestop.timestamp = timestamp;
  }

  startTransaction(user, tagID, meterStart, timestamp) {
    this._model.meterStart = meterStart;
    this._model.timestamp = timestamp;
    if (user) {
      this._model.user = user;
    }
    if (tagID) {
      this._model.tagID = tagID;
    }
  }

  _aggregateAsConsumption(lastMeterValue, meterValue) {
    const currentTimestamp = moment(meterValue.timestamp);
    const diffSecs = currentTimestamp.diff(lastMeterValue.timestamp, 'seconds');
    const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
    const currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;

    const consumption = {
      date: meterValue.timestamp,
      value: currentConsumption,
      cumulated: meterValue.value - this.getMeterStart()
    };
    if (this._hasPricing()) {
      const consumptionWh = meterValue.value - lastMeterValue.value;
      consumption.price = +((consumptionWh / 1000) * this._getPricing().priceKWH).toFixed(6);
    }
    return consumption;
  }

  _hasMeterValues() {
    return this._model.meterValues != null && this._model.meterValues.length > 0 || this._model.internalMeterValues && this._model.internalMeterValues.length > 0;
  }

  _hasConsumptions() {
    return this.getConsumptions().length > 0;
  }

  hasStateOfCharges() {
    return this.getStateOfCharges().length > 0;
  }

  _hasPricing() {
    return !!(this._model.pricing && this._model.pricing.priceKWH >= 0)
  }
}

module.exports = Transaction;