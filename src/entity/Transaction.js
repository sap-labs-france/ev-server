const moment = require('moment');
const Utils = require('../utils/Utils');

class Transaction {
  constructor(model) {
    this._model = model;
    if (!model.meterValues) {
      model.meterValues = [];
    }
  }

  get model() {
    this._model.totalConsumption = this.totalConsumption;
    if (this.isActive()) {
      this._model.currentConsumption = this.currentConsumption;
      if (this.stateOfCharge >= 0) {
        this._model.stateOfCharge = this.stateOfCharge;
      }
    }
    if (this._hasPricing()) {
      this._model.priceUnit = this._model.pricing.priceUnit;
      this._model.price = this.price;
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

  get fullModel() {
    const model = this.model;
    model.user = Utils.duplicateJSON(this._model.user);
    if (this._model.stop) {
      this._model.stop.user = Utils.duplicateJSON(this._model.stop.user);
    }
    model.meterValues = Utils.duplicateJSON(this._model.meterValues);
    model.pricing = Utils.duplicateJSON(this._model.pricing);
    return model;
  }

  get chargerStatus() {
    if (this.isActive() && this._model.chargeBox) {
      return this._model.chargeBox.connectors[this.connectorId - 1].status;
    }
    return undefined;
  }

  get id() {
    return this._model.id;
  }

  get chargeBoxID() {
    return this._model.chargeBoxID;
  }

  get connectorId() {
    return this._model.connectorId;
  }

  get meterStart() {
    return this._model.meterStart;
  }

  get tagID() {
    return this._model.tagID;
  }

  get startDate() {
    return this._model.timestamp;
  }

  get endDate() {
    return this._model.stop.timestamp;
  }

  get initiator() {
    if (this._model.user) {
      return this._model.user;
    }
    return null;
  }

  get finisher() {
    if (this._model.stop.user) {
      return this._model.stop.user;
    }
    return null;
  }

  get finisherTagId() {
    return this._model.stop.tagID;
  }

  get meterStop() {
    return this._model.meterStop;
  }

  get transactionData() {
    return this._model.stop.transactionData;
  }

  get totalConsumption() {
    if (this._hasMeterValues() || !this.isActive()) {
      return Math.floor(this._latestConsumption.cumulated);
    }
    return 0;
  }

  get chargeBox() {
    return this._model.chargeBox;
  }

  get totalDurationSecs() {
    return moment.duration(moment(this.lastUpdateDate).diff(this.startDate)).asSeconds()
  }

  get totalInactivitySecs() {
    let totalInactivitySecs = 0;
    this.consumptions.forEach((consumption, index, array) => {
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

  get price() {
    const price = this.consumptions.map(consumption => consumption.price).reduce((totalPrice, price) => totalPrice + price, 0);
    return isNaN(price) ? 0 : +(price.toFixed(6));
  }

  get priceUnit() {
    if (this._hasPricing()) {
      return this._model.pricing.priceUnit;
    }
    return undefined;
  }

  get lastUpdateDate() {
    return this._latestMeterValue.timestamp;
  }

  get duration() {
    return moment.duration(moment(this.lastUpdateDate).diff(moment(this.startDate)));
  }

  get _latestMeterValue() {
    return this.meterValues[this.meterValues.length - 1];
  }

  get _latestConsumption() {
    return this.consumptions[this.consumptions.length - 1];
  }

  get _latestStateOfCharge() {
    return this.stateOfCharges[this.stateOfCharges.length - 1];
  }

  get currentConsumption() {
    if (this.isActive() && this._hasMeterValues()) {
      return Math.floor(this._latestConsumption.value);
    }
    return 0;
  }

  get meterValues() {
    if (!this._meterValues) {
      this._meterValues = this._computeMeterValues();
    }
    return this._meterValues;
  }

  get consumptions() {
    if (!this._consumptions) {
      this._consumptions = this._computeConsumptions();
    }
    return this._consumptions;
  }

  get stateOfCharges() {
    if (!this._stateOfCharges) {
      this._stateOfCharges = this._computeStateOfCharges();
    }
    return this._stateOfCharges;
  }

  get _firstMeterValue() {
    let attribute = {
      unit: 'Wh',
      location: 'Outlet',
      measurand: 'Energy.Active.Import.Register',
      format: 'Raw',
      context: 'Sample.Periodic'
    };
    return {
      id: '666',
      connectorId: this.connectorId,
      transactionId: this.id,
      timestamp: this.startDate,
      value: this.meterStart,
      attribute: attribute
    };
  }

  get _lastMeterValue() {
    let attribute = {
      unit: 'Wh',
      location: 'Outlet',
      measurand: 'Energy.Active.Import.Register',
      format: 'Raw',
      context: 'Sample.Periodic'
    };
    return {
      id: '6969', connectorId: this.connectorId,
      transactionId: this.id,
      timestamp: this.endDate,
      value: this.meterStop,
      attribute: attribute
    };
  }

  get _pricing() {
    if (this._hasPricing()) {
      return this._model.pricing;
    }
    return undefined;
  }

  get isLoading() {
    if (this.isActive()) {
      return this.getAverageConsumptionOnLast(2) > 0;
    }
    return false;
  }

  get stateOfCharge() {
    if (this._hasStateOfCharges()) {
      return this._latestStateOfCharge.value;
    }
    return undefined;
  }


  get stateEndOfCharge() {
    return this._model.stop.stateOfCharge;
  }

  _computeStateOfCharges() {
    const meterValues = [this._firstMeterValue, ...(this._model.meterValues)];
    if (!this.isActive()) {
      meterValues.push(this._lastMeterValue);
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
    this.meterValues.forEach((meterValue, index, array) => {
      if (index === 0) {
        return;
      }
      consumptions.push(this._aggregateAsConsumption(array[index - 1], meterValue));
    });
    return consumptions;
  }

  _computeMeterValues() {
    const meterValues = [this._firstMeterValue, ...(this._model.meterValues)];
    if (!this.isActive()) {
      meterValues.push(this._lastMeterValue);
    }

    return meterValues
      .filter(meterValue => meterValue.attribute
        && meterValue.attribute.measurand
        && meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  _invalidateComputations() {
    delete this._meterValues;
    delete this._consumptions;
    delete this._stateOfCharges;
  }

  hasMultipleConsumptions() {
    return this.consumptions.length > 1;
  }

  getAverageConsumptionOnLast(numberOfConsumptions) {
    if (numberOfConsumptions > this.consumptions.length) {
      return 1;
    }
    let cumulatedConsumption = 0;
    for (let i = this.consumptions.length - numberOfConsumptions; i < this.consumptions.length; i++) {
      cumulatedConsumption += this.consumptions[i].value;
    }
    return cumulatedConsumption / numberOfConsumptions;
  }

  isActive() {
    return !this._model.stop;
  }

  isRemotelyStopped() {
    return !!this._model.remotestop;
  }

  stop(user, tagId, meterStop, timestamp) {
    this._model.stop = {};
    this._model.meterStop = meterStop;
    this._model.stop.timestamp = timestamp;
    this._model.stop.user = user;
    this._model.stop.tagID = tagId;
    this._invalidateComputations();
    if (this._latestStateOfCharge >= 0) {
      this._model.stop.stateOfCharge = this._latestStateOfCharge;
    }
    if (this._hasPricing()) {
      this._model.priceUnit = this._model.pricing.priceUnit;
      this._model.price = this.price;
    }
    this._model.totalConsumption = this.totalConsumption;
    this._model.totalInactivitySecs = this.totalInactivitySecs;
    this._model.totalDurationSecs = this.totalDurationSecs;
  }

  remoteStop(tagId, timestamp) {
    this._model.remotestop = {};
    this._model.remotestop.tagID = tagId;
    this._model.remotestop.timestamp = timestamp;
  }

  start(user, tagID, meterStart, timestamp) {
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
      cumulated: meterValue.value - this.meterStart
    };
    if (this._hasPricing()) {
      const consumptionWh = meterValue.value - lastMeterValue.value;
      consumption.price = +((consumptionWh / 1000) * this._pricing.priceKWH).toFixed(6);
    }
    return consumption;
  }

  _hasMeterValues() {
    return this._model.meterValues != null && this._model.meterValues.length > 0;
  }

  _hasStateOfCharges() {
    return this.stateOfCharges.length > 0;
  }

  _hasPricing() {
    return !!(this._model.pricing && this._model.pricing.priceKWH >= 0)
  }
}

module.exports = Transaction;