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
    if (this.hasPricing()) {
      return this._model.pricing;
    }
    return undefined;
  }

  getModel() {
    if (this.isActive()) {
      this._model.totalConsumption = this.getTotalConsumption();
      this._model.currentConsumption = this.getCurrentConsumption();
      if (this.hasStateOfCharges()) {
        this._model.currentStateOfCharge = this.getCurrentStateOfCharge();
      }
    }
    if (this.hasStateOfCharges()) {
      this._model.stateOfCharge = this.getStateOfCharge();
    }
    if (this.hasPricing()) {
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
    if (this.hasPricing()) {
      return this._model.pricing.priceUnit;
    }
    return undefined;
  }

  _getLastUpdateDate() {
    return this._getLatestMeterValue().timestamp;
  }

  getDuration() {
    if (!this.isActive()) {
      return moment.duration(moment(this.getEndDate()).diff(moment(this.getStartDate())));
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
      return this.getStateOfCharges()[0].value;
    }
    return undefined;
  }

  getCurrentStateOfCharge() {
    if (this.hasStateOfCharges() && this.isActive()) {
      return this._getLatestStateOfCharge().value;
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
    const meterValues = [this._getFirstMeterValue(), ...(this._model.meterValues)];
    if (!this.isActive()) {
      meterValues.push(this._getLastMeterValue());
    }

    return meterValues
      .filter(meterValue => meterValue.attribute
        && (meterValue.attribute.context === 'Sample.Periodic'
          || meterValue.attribute.context === 'Transaction.Begin'
          || meterValue.attribute.context === 'Transaction.End')
        && meterValue.attribute.measurand === 'SoC')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  _computeConsumptions() {
    const consumptions = [];
    const stateOfCharges = this._computeStateOfCharges();
    this.getMeterValues().forEach((meterValue, index, array) => {
      if (index === 0) {
        return;
      }
      const previousMeterValue = array[index - 1];
      const matchingStates = stateOfCharges.filter(stateOfCharge => moment(stateOfCharge.timestamp).isBetween(previousMeterValue.timestamp, meterValue.timestamp, null, '[]'));
      let stateOfCharge = undefined;
      if (matchingStates.length > 0) {
        stateOfCharge = matchingStates[matchingStates.length - 1];
      }
      consumptions.push(this._aggregateAsConsumption(previousMeterValue, meterValue, stateOfCharge));
    });
    return consumptions;
  }

  _computeMeterValues() {
    let meterValues = [this._getFirstMeterValue(), ...(this._model.meterValues)];
    if (this._hasMeterStop()) {
      meterValues.push(this._getLastMeterValue());
    }

    meterValues = meterValues
      .filter(meterValue => meterValue.attribute
        && meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return this._alignMeterValues(meterValues);
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
      meterValue.registeredValue = meterValue.value;
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

  getRemoteStop() {
    return this._model.remotestop;
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
      this._model.stop.stateOfCharge = this._getLatestStateOfCharge().value;
    }
    if (this.hasPricing()) {
      this._model.priceUnit = this._model.pricing.priceUnit;
      this._model.price = this.getPrice();
    }
    this._model.stop.totalConsumption = this.getTotalConsumption();
    this._model.stop.totalInactivitySecs = this.getTotalInactivitySecs();
    this._model.stop.totalDurationSecs = this.getTotalDurationSecs();
    this.active = false;
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

  _aggregateAsConsumption(lastMeterValue, meterValue, stateOfChargeMeterValue) {
    const currentTimestamp = moment(meterValue.timestamp);
    const diffSecs = currentTimestamp.diff(lastMeterValue.timestamp, 'seconds');
    const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
    const currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;
    const consumption = {
      date: meterValue.timestamp,
      value: currentConsumption,
      cumulated: meterValue.value - this.getMeterStart()
    };
    if (stateOfChargeMeterValue) {
      consumption.stateOfCharge = stateOfChargeMeterValue.value;
    }

    if (this.hasPricing()) {
      const consumptionWh = meterValue.value - lastMeterValue.value;
      consumption.price = +((consumptionWh / 1000) * this._getPricing().priceKWH).toFixed(6);
    }
    return consumption;
  }

  _hasMeterValues() {
    return this._model.meterValues != null && this._model.meterValues.length > 0;
  }

  _hasConsumptions() {
    return this.getConsumptions().length > 0;
  }

  hasStateOfCharges() {
    return this.getStateOfCharges().length > 0;
  }

  hasPricing() {
    return !!(this._model.pricing && this._model.pricing.priceKWH >= 0)
  }
}

module.exports = Transaction;