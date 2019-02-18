const moment = require('moment');
const Database = require('../utils/Database');
const Utils = require('../utils/Utils');
const AbstractTenantEntity = require('./AbstractTenantEntity');
const UserStorage = require('../storage/mongodb/UserStorage');
const ConsumptionStorage = require('../storage/mongodb/ConsumptionStorage');
const TransactionStorage = require('../storage/mongodb/TransactionStorage');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
const SettingStorage = require("../storage/mongodb/SettingStorage");
const ConvergentCharging = require("../integration/pricing/convergent-charging/ConvergentCharging");
const SimplePricing = require("../integration/pricing/simple-pricing/SimplePricing");
const Constants = require('../utils/Constants');

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

  setCurrentConsumptionWh(currentConsumptionWh) {
    this._model.currentConsumptionWh = currentConsumptionWh;
  }

  getCurrentConsumptionWh() {
    return this._model.currentConsumptionWh ? this._model.currentConsumptionWh : 0;
  }

  getCurrentCumulatedPrice() {
    return this._model.currentCumulatedPrice ? this._model.currentCumulatedPrice : 0;
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

  getMeterStart() {
    return this._model.meterStart;
  }

  getStartDate() {
    return this._model.timestamp;
  }

  getLastUpdateDate() {
    return this._model.lastUpdate;

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

  getChargeBoxID() {
    return this._model.chargeBoxID;
  }

  async getChargingStation() {
    // Get from DB
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this._model.chargeBoxID);
    // Keep it
    this.setChargingStation(chargingStation);
    return chargingStation;
  }

  setChargingStation(chargingStation) {
    if (chargingStation) {
      this._model.chargeBox = chargingStation.getModel();
      this._model.chargeBoxID = chargingStation.getID();
    } else {
      this._model.chargeBox = null;
    }
  }

  getStartPrice() {
    return this._model.price;
  }

  getStartRoundedPrice() {
    return this._model.roundedPrice;
  }

  getStartPriceUnit() {
    return this._model.priceUnit;
  }

  getStartPricingSource() {
    return this._model.pricingSource;
  }

  getPrice() {
    if (this.isFinished()) {
      return this._model.stop.price;
    }
  }

  getRoundedPrice() {
    if (this.isFinished()) {
      return this._model.stop.roundedPrice;
    }
  }

  getPriceUnit() {
    if (this.isFinished()) {
      return this._model.stop.priceUnit;
    }
  }

  getPricingSource() {
    if (this.isFinished()) {
      return this._model.stop.pricingSource;
    }
  }

  hasPrice() {
    return this.isFinished() && this.getPrice() >= 0;
  }

  async getConsumptions() {
    const consumptions = await ConsumptionStorage.getConsumptions(this.getTenantID(), this.getID());
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
    this.setCurrentConsumptionWh(0);
    this.setUser(user);

    const meterValue = {
      id: '666',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: this.getStartDate(),
      value: this.getMeterStart(),
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    };

    // Build consumption
    const consumption = await this.buildConsumption(this.getStartDate(), this.getStartDate(), meterValue);
    // Update the price
    await this.computePricing(consumption, 'start');
  }

  /**
   *
   * @param meterValue
   * @param consumption {Consumption}
   * @returns {Promise<*>}
   */
  async updateWithMeterValue(meterValue) {
    // Get the last one
    const lastMeterValue = this.getLastMeterValue();
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
      // Update
      this.setNumberOfMeterValues(this.getNumberOfMeterValues() + 1);
      this.setLastMeterValue({
        value: Utils.convertToInt(meterValue.value),
        timestamp: Utils.convertToDate(meterValue.timestamp).toISOString()
      });
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
        this.setCurrentConsumptionWh(consumption);
        this.getModel().lastUpdate = meterValue.timestamp;
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
    // Return the last meter value
    return lastMeterValue;
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
      const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
      const currentConsumption = consumption * sampleMultiplier;
      // Update current consumption
      this.setCurrentConsumption(currentConsumption);
      this.setCurrentTotalConsumption(this.getCurrentTotalConsumption() + consumption);
      this.setCurrentConsumptionWh(consumption);
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
    const meterValueData = {
      id: '6969',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: timestamp,
      value: meterStop,
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    };

    // Build final consumption
    const consumption = await this.buildConsumption(lastMeterValue.timestamp, timestamp, meterValueData);
    // Update the price
    await this.computePricing(consumption, 'stop');
    // Save Consumption
    await this.saveConsumption(consumption);
    // Remove runtime data
    delete this._model.currentConsumption;
    delete this._model.currentStateOfCharge;
    delete this._model.currentTotalConsumption;
    delete this._model.currentTotalInactivitySecs;
    delete this._model.currentCumulatedPrice;
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


  async buildConsumption(startedAt, endedAt, meterValue) {
    const consumption = {
      transactionId: this.getID(),
      connectorId: this.getConnectorId(),
      chargeBoxID: this.getChargeBoxID(),
      siteAreaID: this.getSiteAreaID(),
      siteID: this.getSiteID(),
      userID: this.getUserID(),
      endedAt: endedAt
    };
    // SoC?
    if (this.isSocMeterValue(meterValue)) {
      // Set SoC
      consumption.stateOfCharge = this.getCurrentStateOfCharge();
    } else {
      // Set Consumption
      consumption.startedAt = startedAt;
      consumption.consumption = this.getCurrentConsumptionWh();
      consumption.instantPower = this.getCurrentConsumption();
      consumption.cumulatedConsumption = this.getCurrentTotalConsumption();
      consumption.totalInactivitySecs = this.getCurrentTotalInactivitySecs();
      consumption.totalDurationSecs = this.getCurrentTotalDurationSecs();
      consumption.stateOfCharge = this.getCurrentStateOfCharge();
    }
    // Return
    return consumption;
  }

  async getPricingImpl() {
    // Check if the pricing is active
    if ((await this.getTenant()).isComponentActive(Constants.COMPONENTS.PRICING)) {
      // Get the pricing's settings
      const setting = await SettingStorage.getSettingByIdentifier(this.getTenantID(), Constants.COMPONENTS.PRICING);
      // Check
      if (setting) {
        // Check if CC
        if (setting.getContent()['convergentCharging']) {
          // Return the CC implementation
          return new ConvergentCharging(this.getTenantID(), setting.getContent()['convergentCharging'], this);
        } else if (setting.getContent()['simple']) {
          // Return the Simple Pricing implementation
          return new SimplePricing(this.getTenantID(), setting.getContent()['simple'], this);
        }
      }
    }
    // Pricing is not active
    return null;
  }

  delete() {
    // Delete
    return TransactionStorage.deleteTransaction(this.getTenantID(), this);
  }

  save() {
    return TransactionStorage.saveTransaction(this.getTenantID(), this.getModel());
  }

  async updateWithMeterValues(meterValues) {
    // Save Meter Values
    await TransactionStorage.saveMeterValues(this.getTenantID(), meterValues);
    // Process consumption
    const consumptions = [];
    for (const meterValue of meterValues.values) {
      // Update Transaction with Meter Values
      const lastMeterValue = await this.updateWithMeterValue(meterValue);
      // Compute consumption
      let consumption = await this.buildConsumption(lastMeterValue.timestamp, meterValue.timestamp, meterValue);
      const consumptionToUpdateWith = consumptions.find(c => c.endedAt.getTime() === consumption.endedAt.getTime());
      consumption.toPrice = this.isConsumptionMeterValue(meterValue);
      if (consumptionToUpdateWith) {
        consumptions.slice(consumptions.indexOf(consumptionToUpdateWith, 1));
        consumption = {...consumptionToUpdateWith, ...consumption};
      }
      consumptions.push(consumption);
    }
    for (const consumption of consumptions) {
      if (consumption.toPrice) {
        // Update the price
        await this.computePricing(consumption, 'update');
      }
      // Save Consumption
      await this.saveConsumption(consumption);
    }
  }

  async computePricing(consumptionData, action) {
    let consumption;
    // Get the pricing impl
    const pricingImpl = await this.getPricingImpl();
    switch (action) {
      // Start Transaction
      case 'start':
        // Active?
        if (pricingImpl) {
          // Set
          consumption = await pricingImpl.startSession(consumptionData);
          // Set the initial pricing
          this._model.price = consumption.amount;
          this._model.roundedPrice = consumption.roundedAmount;
          this._model.priceUnit = consumption.currencyCode;
          this._model.pricingSource = consumption.pricingSource;
          // Init the cumulated price
          this._model.currentCumulatedPrice = consumption.amount;
        } else {
          // Default
          this._model.price = 0;
          this._model.roundedPrice = 0;
          this._model.priceUnit = "";
          this._model.pricingSource = "";
        }
        break;
      // Meter Values
      case 'update':
        // Active?
        if (pricingImpl) {
          // Set
          consumption = await pricingImpl.updateSession(consumptionData);
          // Update consumption
          consumptionData.amount = consumption.amount;
          consumptionData.roundedAmount = consumption.roundedAmount;
          consumptionData.currencyCode = consumption.currencyCode;
          consumptionData.pricingSource = consumption.pricingSource;
          if (!consumption.cumulatedAmount) {
            consumptionData.cumulatedAmount = parseFloat((this.getCurrentCumulatedPrice() + consumptionData.amount).toFixed(6));
          }
          // Keep latest
          this._model.currentCumulatedPrice = consumptionData.cumulatedAmount;
        }
        break;
      // Stop Transaction
      case 'stop':
        // Active?
        if (pricingImpl) {
          // Set
          consumption = await pricingImpl.stopSession(consumptionData);
          // Update consumption
          consumptionData.amount = consumption.amount;
          consumptionData.roundedAmount = consumption.roundedAmount;
          consumptionData.currencyCode = consumption.currencyCode;
          consumptionData.pricingSource = consumption.pricingSource;
          if (!consumption.cumulatedAmount) {
            consumptionData.cumulatedAmount = parseFloat((this.getCurrentCumulatedPrice() + consumptionData.amount).toFixed(6));
          }
          this._model.currentCumulatedPrice = consumptionData.cumulatedAmount;
          // Update Transaction
          this._model.stop.price = parseFloat(this.getCurrentCumulatedPrice().toFixed(6));
          this._model.stop.roundedPrice = (this.getCurrentCumulatedPrice()).toFixed(2);
          this._model.stop.priceUnit = consumption.currencyCode;
          this._model.stop.pricingSource = consumption.pricingSource;
        }
        break;
    }
  }

  async roundTo(number, scale) {
    return parseFloat(number.toFixed(scale));
  }

  async saveConsumption(consumption) {
    // Save
    return ConsumptionStorage.saveConsumption(this.getTenantID(), consumption);
  }
}

module.exports = Transaction;