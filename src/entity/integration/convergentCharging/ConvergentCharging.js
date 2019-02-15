const StatefulChargingService = require('./StatefulChargingService');
const moment = require('moment');
const Logging = require('../../../utils/Logging');

const CI_NAME = '[CA] Charging Data';

class ConvergentCharging {
  /**
   *
   * @param tenantId {string}
   * @param chargingStation {ChargingStation}
   */
  constructor(tenantId, chargingStation, setting) {
    this.chargingStation = chargingStation;
    this.tenantId = tenantId;
    this.setting = setting;
    this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, this.setting.password);
  }

  async startSession(consumptionData) {
    const reservationItem = new ReservationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, consumptionData.consumption)]);
    const request = new StartRateRequest(reservationItem, consumptionData.transactionId, moment(consumptionData.startedAt).format('YYYY-MM-DDTHH:mm:ss'), 'ENERGY', consumptionData.userID, 'cancelled', 30000, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING', null);
    const result = await this.statefulChargingService.execute(request);
    if (result.data.startRateResult) {
      const rateResult = new RateResult(result.data.startRateResult);
      console.log("startRateResult");
      console.log(JSON.stringify(rateResult));
      this.handleAlertNotification(consumptionData, rateResult);
      return {
        amount: 0,
        cumulatedAmount: 0,
        currencyCode: rateResult.transactionsToReserve.getCurrencyCode(),
        roundedAmount: 0,
        pricingSource: 'ConvergentCharging'
      }
    } else {
      const chargingResult = result.data.chargingResult;
      if (chargingResult.status === 'error') {
        Logging.logError({
          tenantID: this.tenantId,
          source: consumptionData.transactionId, module: 'ConvergentCharging',
          method: 'StartSession', action: 'StartSession',
          message: chargingResult.message,
          detailedMessages: chargingResult
        });
      }
    }
  }

  async updateSession(consumptionData) {
    const confirmationItem = new ConfirmationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, consumptionData.consumption)]);
    const reservationItem = new ReservationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, consumptionData.consumption)]);

    const request = new UpdateRateRequest(confirmationItem, reservationItem, consumptionData.transactionId, moment(consumptionData.endedAt).format('YYYY-MM-DDTHH:mm:ss'), 'ENERGY', consumptionData.userID, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.updateRateResult) {
      const rateResult = new RateResult(result.data.updateRateResult);
      this.handleAlertNotification(consumptionData, rateResult);

      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: 'ConvergentCharging'
      }
    } else {
      const chargingResult = result.data.chargingResult;
      if (chargingResult.status === 'error') {
        Logging.logError({
          tenantID: this.tenantId,
          source: consumptionData.transactionId, module: 'ConvergentCharging',
          method: 'updateSession', action: 'updateSession',
          message: chargingResult.message,
          detailedMessages: chargingResult
        });
        return null;
      }
    }
  }

  async stopSession(consumptionData) {
    const confirmationItem = new ConfirmationItem(CI_NAME, [new ChargeableItemProperty('Consumption', Type.number, consumptionData.consumption)]);

    const request = new StopRateRequest(confirmationItem, consumptionData.transactionId, 'ENERGY', consumptionData.userID, 'confirmed', 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.stopRateResult) {
      const rateResult = new RateResult(result.data.stopRateResult);
      this.handleAlertNotification(consumptionData, rateResult);
      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: 'ConvergentCharging'
      }
    } else {
      const chargingResult = result.data.chargingResult;
      if (chargingResult.status === 'error') {
        Logging.logError({
          tenantID: this.tenantId,
          source: consumptionData.getID(), module: 'ConvergentCharging',
          method: 'stopSession', action: 'stopSession',
          message: chargingResult.message,
          detailedMessages: chargingResult
        });
      }
    }
  }


  /**
   *
   * @param consumptionData
   * @param notification {RateResult}
   */
  handleAlertNotification(consumptionData, rateResult) {
    if (rateResult.transactionsToConfirm) {
      for (const ccTransaction of rateResult.transactionsToConfirm.ccTransactions) {
        if (ccTransaction.notifications) {
          for (const notification of ccTransaction.notifications) {
            switch (notification.code) {
              case "STOP_TRANSACTION":
                this.chargingStation.requestStopTransaction({transactionId: consumptionData.transactionId});
                break;
              case "START_TRANSACTION":
                this.chargingStation.requestStartTransaction({tagID: consumptionData.tagID, connectorID: consumptionData.connectorId});
                break;
            }

          }
        }
      }
    }
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
    if (model.$attributes.amountToConfirm) {
      this.amountToConfirm = this.parseAmount(model.$attributes.amountToConfirm).value;
    }
    if (model.$attributes.amountToReserve) {
      this.amountToReserve = this.parseAmount(model.$attributes.amountToReserve).value;
    }
    if (model.$attributes.amountToCancel) {
      this.amountToCancel = this.parseAmount(model.$attributes.amountToCancel).value;
    }
    if (model.$attributes.accumulatedAmount) {
      this.accumulatedAmount = this.parseAmount(model.$attributes.accumulatedAmount).value;
    }
    if (model.$attributes.transactionSetID) {
      this.transactionSetID = model.$attributes.transactionSetID;
    }

    if (model.transacSetToReserve) {
      this.transactionsToReserve = new TransactionSet(model.transacSetToReserve);
    }
    if (model.transacSetToConfirm) {
      this.transactionsToConfirm = new TransactionSet(model.transacSetToConfirm);
    }
    if (model.transacSetToCleanup) {
      this.transactionsToCleanup = new TransactionSet(model.transacSetToCleanup);
    }
  }

  /**
   *
   * @param amount {string}
   */
  parseAmount(amount) {
    if (amount) {
      return {
        value: parseFloat(amount.substr(4)),
        currency: amount.substr(0, 3)
      }
    }
    return null;
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

  getTotalUnroundedAmount() {
    return this.ccTransactions.map(t => parseFloat(t.details['default.unrounded_amount']))
      .reduce((previousValue, currentValue) => previousValue + currentValue, 0);
  }

  getCurrencyCode() {
    return this.ccTransactions[0].details['default.iso_currency_code'];
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