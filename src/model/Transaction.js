const moment = require('moment');
const Utils = require('../utils/Utils');

class Transaction {
  constructor(model, pricing) {
    this._model = model;
    if (!model.meterValues) {
      model.meterValues = [];
    }
    if (pricing) {
      this._pricing = pricing;
    }
  }

  get model() {
    if (this._pricing) {
      this._model.totalPrice = this.totalPrice;
    }
    this._model.totalConsumption = this.totalConsumption;
    this._model.currentConsumption = this.currentConsumption;
    if (!this.isActive()) {
      this._model.stop.totalInactivitySecs = this.totalInactivitySecs;
      this._model.stop.totalConsumption = this._model.totalConsumption;
    }
    if(this.totalDurationInSecs){
      this._model.totalDurationInSecs = this.totalDurationInSecs;
    }
    if (this._model.user) {
      this._model.userID = this._model.user.id;
    }
    if (this._model.stop && this._model.stop.user) {
      this._model.stop.userID = this._model.stop.user.id;
    }
    const copy = Utils.duplicateJSON(this._model);
    delete copy.meterValues;
    return copy;
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

  get startedBy() {
    return this._model.user;
  }

  get stoppedBy() {
    return this._model.stop.user;
  }

  get stoppedByTag() {
    return this._model.stop.tagID;
  }

  get meterStop() {
    return this._model.stop.meterStop;
  }

  get transactionData() {
    return this._model.stop.transactionData;
  }

  get totalConsumption() {
    const meterValues = this.meterValues;
    return meterValues[meterValues.length - 1].value;
  }

  get totalDurationInSecs() {
    if (this.isActive()) {
      return undefined;
    }
    return moment.duration(moment(this._model.stop.timestamp).diff(this._model.timestamp)).asSeconds()
  }

  get totalPrice() {
    return this.consumptions.reduce((totalPrice, consumption) => totalPrice + consumption.price, 0);
  }

  get totalInactivitySecs() {
    let totalInactivitySecs = 0;
    this.consumptions.forEach((consumption, index, array) => {
      if (index === 0) {
        return;
      }
      const lastConsumption = array[index - 1];
      if (consumption.value == 0 && lastConsumption.value == 0) {
        totalInactivitySecs += moment.duration(moment(consumption.date).diff(lastConsumption.date)).asSeconds();
      }
    });
    return totalInactivitySecs;
  }

  get currentConsumption() {
    if (this.isActive() && this._hasMeterValues()) {
      const consumptions = this.consumptions;
      return consumptions[consumptions.length - 1].value;
    }
    return 0;
  }

  get meterValues() {
    const meterValues = [this._firstMeterValue, ...(this._model.meterValues)]
    if (!this.isActive()) {
      meterValues.push(this._lastMeterValue);
    }
    return meterValues.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  get consumptions() {
    const consumptions = [];
    this.meterValues.forEach((meterValue, index, array) => {
      if (index === 0) {
        return;
      }
      consumptions.push(this._aggregateAsConsumption(array[index - 1], meterValue));
    });
    return consumptions;
  }

  get _firstMeterValue() {
    let attribute;
    if (this._hasMeterValues()) {
      attribute = this._model.meterValues[0].attribute;
    } else {
      attribute = {
        unit: 'Wh',
        location: 'Outlet',
        measurand: 'Energy.Active.Import.Register',
        format: 'Raw',
        context: 'Sample.Periodic'
      };
    }
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
    let attribute;
    if (this._hasMeterValues()) {
      attribute = this._model.meterValues[0].attribute;
    } else {
      attribute = {
        unit: 'Wh',
        location: 'Outlet',
        measurand: 'Energy.Active.Import.Register',
        format: 'Raw',
        context: 'Sample.Periodic'
      };
    }
    return {
      id: '6969', connectorId: this.connectorId,
      transactionId: this.id,
      timestamp: this.endDate,
      value: this.meterStop,
      attribute: attribute
    };
  }

  isActive() {
    return !this._model.stop;
  }

  stop(user, tagId, meterStop, timestamp) {
    this._model.stop = {};
    this._model.stop.meterStop = meterStop;
    this._model.stop.timestamp = timestamp;
    this._model.stop.user = user;
    this._model.stop.tagID = tagId;
    this._model.stop.totalInactivitySecs = this.totalInactivitySecs;
    this._model.stop.totalConsumption = this.totalConsumption;
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
    const sampleMultiplier = 3600 / diffSecs;
    const currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;
    const consumptionWh = meterValue.value - lastMeterValue.value;

    const consumption = {
      date: meterValue.timestamp,
      value: currentConsumption,
      cumulated: meterValue.value
    };
    if (this._pricing) {
      consumption.price = (consumptionWh / 1000) * this._pricing.priceKWH;
    }
    return consumption;
  }

  _hasMeterValues() {
    return this._model.meterValues != null && this._model.meterValues.length > 0;
  }

}

module.exports = Transaction;