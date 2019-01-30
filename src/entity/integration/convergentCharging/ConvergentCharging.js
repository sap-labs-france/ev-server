const StatefulChargingService = require('./StatefulChargingService');
const SettingStorage = require("../../../storage/mongodb/SettingStorage");
const TransactionStorage = require("../../../storage/mongodb/TransactionStorage");
const moment = require('moment');

const CI_NAME = '[CA] Charging Data';

class ConvergentCharging {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async initialize() {
    if (!this.setting) {
      this.setting = await SettingStorage.getSettingByIdentifier(this.tenantId, 'pricing');
      this.setting = this.setting.getContent()['convergentCharging'];
      if (!this.setting) {
        return false
      }
      this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, this.setting.password);
    }
    return true;
  }

  /**
   * @param transaction {Transaction}
   */
  async startTransaction(transaction) {
    const readyState = await this.initialize();
    if (!readyState) {
      return;
    }
    const reservationItem = new ReservationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, transaction.getCurrentConsumptionWh())]);
    const request = new StartRateRequest(reservationItem, transaction.getID(), moment(transaction.getStartDate()).format('YYYY-MM-DDTHH:mm:ss'), 'ENERGY', transaction.getUserID(), 'cancelled', 30000, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    const startRateResult = new StartRateResult(result.data.startRateResult);
    console.log("startRateResult");
    console.log(JSON.stringify(startRateResult));
  }

  convertTransactionToMeterValue(transaction) {

  }

  /**
   * @param transaction {Transaction}
   */
  async updateTransaction(transaction) {
    const readyState = await this.initialize();
    if (!readyState) {
      return;
    }
    const confirmationItem = new ConfirmationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, transaction.getCurrentConsumptionWh())]);
    const reservationItem = new ReservationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, transaction.getCurrentConsumptionWh())]);

    const request = new UpdateRateRequest(confirmationItem, reservationItem, transaction.getID(), moment(transaction.getLastUpdateDate()).format('YYYY-MM-DDTHH:mm:ss'), 'ENERGY', transaction.getUserID(), 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    const updateRateResult = new UpdateRateResult(result.data.updateRateResult);
    console.log("updateRateResult");
    console.log(JSON.stringify(updateRateResult));
  }

  /**
   * @param transaction {Transaction}
   */
  async stopTransaction(transaction) {
    const readyState = await this.initialize();
    if (!readyState) {
      return;
    }
    const confirmationItem = new ConfirmationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, transaction.getCurrentConsumptionWh())]);

    const request = new StopRateRequest(confirmationItem, transaction.getID(), 'ENERGY', transaction.getUserID(), 'confirmed', 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    const stopRateResult = new StopRateResult(result.data.stopRateResult);
    console.log("stopRateResult");
    console.log(JSON.stringify(stopRateResult));
  }


}

class ChargingRequest {
  /**
   *
   * @param chargeableItem {ChargeableItem}
   * @param transactionSelection {string}
   * @param filterTransaction {string}
   */
  constructor(chargeableItem, transactionSelection, filterTransaction) {
    this.chargeableItem = chargeableItem;
    this.transactionSelection = transactionSelection;
    this.filterTransaction = filterTransaction;
  }
}

class StartRateRequest {
  /**
   *
   * @param reservationItem {ReservationItem}
   * @param sessionID
   * @param consumptionDate
   * @param serviceId
   * @param userTechnicalId
   * @param defaultResolution
   * @param timeToLive
   * @param resultType
   * @param filterTransaction
   * @param cleanupResultType
   * @param propertyToInverse
   */
  constructor(reservationItem, sessionID, consumptionDate, serviceId, userTechnicalId, defaultResolution, timeToLive, resultType, filterTransaction, cleanupResultType, propertyToInverse) {
    this.reservationItem = reservationItem;
    this.sessionID = sessionID;
    this.consumptionDate = consumptionDate;
    this.serviceId = serviceId;
    this.userTechnicalId = userTechnicalId;
    this.defaultResolution = defaultResolution;
    this.timeToLive = timeToLive;
    this.resultType = resultType;
    this.filterTransaction = filterTransaction;
    this.cleanupResultType = cleanupResultType;
    this.propertyToInverse = propertyToInverse;
  }

  getName() {
    return 'statefulStartRate';
  }
}

class RateResult {
  constructor(model) {
    if (model.transacSetToReserve) {
      this.transactionsToReserve = new TransactionSet(model.transacSetToReserve);
    }
    if (model.transacSetToConfirm) {
      this.masterTransactionToConfirm = new TransactionSet(model.transacSetToReserve);
    }
    if (model.transacSetToCleanup) {
      this.masterTransactionToConfirm = new TransactionSet(model.transacSetToReserve);
    }
  }
}

class StartRateResult extends  RateResult{
  constructor(model) {
    super(model);
    this.amountToConfirm = model.$attributes.amountToConfirm;
    this.amountToReserve = model.$attributes.amountToReserve;
    this.transactionSetID = model.$attributes.transactionSetID;
  }
}


class UpdateRateResult {
  constructor(amountToConfirm, amountToReserve, amountToCancel, accumulatedAmount, limit) {
    this.amountToConfirm = amountToConfirm;
    this.amountToReserve = amountToReserve;
    this.amountToCancel = amountToCancel;
    this.accumulatedAmount = accumulatedAmount;
    this.limit = limit;
    this.toConfirm = {};
    this.toReserve = {};
  }

  static parse(model) {
    const result = new UpdateRateResult(model.$attributes.amountToConfirm, model.$attributes.amountToReserve, model.$attributes.amountToCancel, model.$attributes.accumulatedAmount);
    if (model.transacSetToReserve && model.transacSetToReserve.master) {
      result.masterTransactionToReserve = new CCTransaction(model.transacSetToReserve.master);
    }
    if (model.transacSetToConfirm && model.transacSetToConfirm.master) {
      result.masterTransactionToConfirm = new CCTransaction(model.transacSetToConfirm.master);
    }
    return result;
  }
}

class StopRateResult {
  constructor(amountToConfirm, amountToCancel, accumulatedAmount) {
    this.amountToConfirm = amountToConfirm;
    this.amountToCancel = amountToCancel;
    this.accumulatedAmount = accumulatedAmount;
  }

  static parse(model) {
    const result = new StopRateResult(model.$attributes.amountToConfirm, model.$attributes.amountToReserve, model.$attributes.amountToCancel, model.$attributes.accumulatedAmount);
    if (model.transacSetToReserve && model.transacSetToReserve.master) {
      result.masterTransactionToReserve = new CCTransaction(model.transacSetToReserve.master);
    }
    if (model.transacSetToConfirm && model.transacSetToConfirm.master) {
      result.masterTransactionToConfirm = new CCTransaction(model.transacSetToConfirm.master);
    }
    return result;
  }
}

class UpdateRateRequest {
  /**
   *
   * @param confirmationItem {ConfirmationItem}
   * @param reservationItem
   * @param sessionID
   * @param consumptionDate
   * @param serviceId
   * @param userTechnicalId
   * @param resultType
   * @param filterTransaction
   * @param cleanupResultType
   */
  constructor(confirmationItem, reservationItem, sessionID, consumptionDate, serviceId, userTechnicalId, resultType, filterTransaction, cleanupResultType) {
    this.confirmationItem = confirmationItem;
    this.reservationItem = reservationItem;
    this.sessionID = sessionID;
    this.consumptionDate = consumptionDate;
    this.serviceId = serviceId;
    this.userTechnicalId = userTechnicalId;
    this.resultType = resultType;
    this.filterTransaction = filterTransaction;
    this.cleanupResultType = cleanupResultType;
  }

  getName() {
    return 'statefulUpdateRate';
  }
}

class StopRateRequest {
  /**
   *
   * @param confirmationItem {ConfirmationItem}
   * @param sessionID
   * @param serviceId
   * @param userTechnicalId
   * @param resolution
   * @param resultType
   * @param filterTransaction
   * @param cleanupResultType
   */
  constructor(confirmationItem, sessionID, serviceId, userTechnicalId, resolution, resultType, filterTransaction, cleanupResultType) {
    this.confirmationItem = confirmationItem;
    this.sessionID = sessionID;
    this.serviceId = serviceId;
    this.userTechnicalId = userTechnicalId;
    this.resolution = resolution;
    this.resultType = resultType;
    this.filterTransaction = filterTransaction;
    this.cleanupResultType = cleanupResultType;
  }

  getName() {
    return 'statefulStopRate';
  }
}


class ReservationItem {
  /**
   *
   * @param name
   * @param properties {ChargeableItemProperty[]}
   */
  constructor(name, properties = []) {
    this.name = name;
    this.property = properties;
  }
}

class ConfirmationItem {
  /**
   *
   * @param name
   * @param properties {ChargeableItemProperty[]}
   */
  constructor(name, properties = []) {
    this.name = name;
    this.property = properties;
  }
}

class ChargeableItem {
  /**
   *
   * @param name
   * @param userTechnicalId
   * @param serviceId
   * @param consumptionDate
   * @param properties {ChargeableItemProperty[]}
   */
  constructor(name, userTechnicalId, serviceId, consumptionDate, properties = []) {
    this.name = name;
    this.userTechnicalId = userTechnicalId;
    this.serviceId = serviceId;
    this.consumptionDate = consumptionDate;
    this.property = properties;
  }
}

class ChargeableItemProperty {
  /**
   *
   * @param name
   * @param type {Type}
   * @param value
   */
  constructor(name, type, value) {
    this.name = name;
    this[type + 'Value'] = value
  }
}

const Type = {
  number: 'number',
  string: 'string',
  date: 'date',
};

class TransactionSet {
  constructor(model) {
    if (Array.isArray(model)) {
      this.ccTransactions = model.map(cctrModel => new CCTransaction(cctrModel.master));
    } else {
      this.ccTransactions = [new CCTransaction(model.master)];
    }
  }
}

class Notification {
  constructor(model) {
    this.instanceId = model['$attributes'].instanceId;
    this.timestamp = model['$attributes'].timestamp;
    this.descUid = model['$attributes'].descUid;
    this.name = model['$attributes'].name;
    this.prettyName = model['$attributes'].prettyName;
    this.severityLevel = model['$attributes'].severityLevel;

    model.arg.map(detail => detail['$attributes']).forEach(detail => this[detail.name] = detail.value);
  }
}

class CCTransaction {
  constructor(model) {
    for (const key of Object.keys(model['$attributes'])) {
      this[key] = model['$attributes'][key];
    }
    this.details = {};
    model.detail.map(detail => detail['$attributes']).forEach(
      detail => {
        let value;
        switch (detail.type) {
          case 'decimal':
            value = Number.parseFloat(detail.value);
            break;
          case 'date':
            value = new Date(detail.value);
            break;
          case 'string':
          default:
            value = detail.value;
        }
        this.details[detail.name] = value;
      });
    if (model.notification) {
      if (Array.isArray(model.notification)) {
        this.notifications = model.notification.map(n => new Notification(n));
      } else {
        this.notifications = [new Notification(model.notification)];
      }
    }

  }

  static parse(model) {

  }

  getAmount() {
    return this.amount;
  }

  getAmountValue() {
    return Number.parseFloat(this.getAmount().substr(4));
  }

  getChargePlanId() {
    return this.chargePlanId;
  }

  getChargingContractId() {
    return this.chargingContractId;
  }

  getChargeCode() {
    return this.chargeCode;
  }

  getOrigin() {
    return this.origin;
  }

  getDate() {
    return this.date;
  }

  getLabel() {
    return this.label;
  }

  getRelationshipType() {
    return this.relationshipType;
  }

  getOperationType() {
    return this.operationType;
  }

  getSessionID() {
    return this.sessionID;
  }

  getDetails() {
    return this.details;
  }
}

module.exports = ConvergentCharging;