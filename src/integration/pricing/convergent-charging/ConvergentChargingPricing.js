const StatefulChargingService = require('./StatefulChargingService');
const moment = require('moment-timezone');
const Logging = require('../../../utils/Logging');
const Pricing = require('../Pricing');
const SiteArea = require('../../../entity/SiteArea');
const Safe = require('../../../utils/Safe');


class ConvergentChargingPricing extends Pricing {
  constructor(tenantId, setting, transaction) {
    super(tenantId, setting, transaction);
    var passwordUnhashed = Safe.decrypt(this.setting.password);
    this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, passwordUnhashed);
  }

  consumptionToChargeableItemProperties(consumptionData) {
    const timezone = this.transaction.getTimezone();
    const startedAt = timezone ? moment.tz(consumptionData.startedAt, timezone) : moment.utc(consumptionData.startedAt).local();
    const endedAt = timezone ? moment.tz(consumptionData.endedAt, timezone) : moment.utc(consumptionData.endedAt).local();
    return [
      new ChargeableItemProperty('userID', Type.string, consumptionData.userID),
      new ChargeableItemProperty('chargeBoxID', Type.string, consumptionData.chargeBoxID),
      new ChargeableItemProperty('siteID', Type.string, consumptionData.siteID),
      new ChargeableItemProperty('siteAreaID', Type.string, consumptionData.siteAreaID),
      new ChargeableItemProperty('connectorId', Type.number, consumptionData.connectorId),
      new ChargeableItemProperty('startedAt', Type.date, startedAt.format('YYYY-MM-DDTHH:mm:ss')),
      new ChargeableItemProperty('endedAt', Type.date, endedAt.format('YYYY-MM-DDTHH:mm:ss')),
      new ChargeableItemProperty('cumulatedConsumption', Type.number, consumptionData.cumulatedConsumption),
      new ChargeableItemProperty('consumption', Type.number, consumptionData.consumption),
      new ChargeableItemProperty('stateOfCharge', Type.number, consumptionData.stateOfCharge),
    ];
  }

  computeSessionId(consumptionData) {

    const dataId = consumptionData.userID + consumptionData.chargeBoxID + consumptionData.connectorId + this.transaction.getStartDate();

    let hash = 0, i, chr;
    if (dataId.length === 0) return hash;
    for (i = 0; i < dataId.length; i++) {
      chr = dataId.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  async startSession(consumptionData) {
    const siteArea =  await SiteArea.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
    const sessionId = this.computeSessionId(consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'start'));
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StartRateRequest(reservationItem, sessionId, moment(consumptionData.startedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.getName(), consumptionData.userID, 'cancelled', 30000, 'ALL_TRANSACTION_AND_RECURRING',
      false, 'ALL_TRANSACTION_AND_RECURRING', null);
    const result = await this.statefulChargingService.execute(request);
    if (result.data.startRateResult) {
      const rateResult = new RateResult(result.data.startRateResult);
      this.handleAlertNotification(consumptionData, rateResult);
      return {
        amount: 0,
        cumulatedAmount: 0,
        currencyCode: rateResult.transactionsToReserve.getCurrencyCode(),
        roundedAmount: 0,
        pricingSource: 'ConvergentCharging'
      };
    } else {
      this.handleError(consumptionData, result);
      return {};
    }
  }

  async updateSession(consumptionData) {
    const siteArea =  await SiteArea.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
    const sessionId = this.computeSessionId(consumptionData);

    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'update'));
    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);

    const request = new UpdateRateRequest(confirmationItem, reservationItem, sessionId, moment(consumptionData.endedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.getName(), consumptionData.userID, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
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
      };
    } else {
      this.handleError(consumptionData, result);
      return {};
    }
  }

  async stopSession(consumptionData) {
    const siteArea =  await SiteArea.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
    const sessionId = this.computeSessionId(consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'stop'));

    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);

    const request = new StopRateRequest(confirmationItem, sessionId, siteArea.getName(), consumptionData.userID, 'confirmed',
      'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
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
      };
    } else {
      this.handleError(consumptionData, result);
      return {};
    }
  }

  async handleError(consumptionData, result) {
    const chargingResult = result.data.chargingResult;
    if (chargingResult.status === 'error') {

      if (chargingResult.error.category === 'invalid' && chargingResult.error.message.startsWith('Not authorized')) {
        const chargingStation = await this.transaction.getChargingStation();
        if (chargingStation) {
          chargingStation.requestRemoteStopTransaction({
            tagID: consumptionData.tagID,
            connectorID: consumptionData.connectorId
          });
        }
      } else {
        Logging.logError({
          tenantID: this.tenantId,
          source: consumptionData.transactionId, module: 'ConvergentCharging',
          method: 'handleError', action: 'handleError',
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
  async handleAlertNotification(consumptionData, rateResult) {
    let chargingStation = null;
    if (rateResult.transactionsToConfirm) {
      for (const ccTransaction of rateResult.transactionsToConfirm.ccTransactions) {
        if (ccTransaction.notifications) {
          for (const notification of ccTransaction.notifications) {
            switch (notification.code) {
              case "CSMS_INFO":
                chargingStation = await this.transaction.getChargingStation();
                if (chargingStation) {
                  chargingStation.requestSetChargingProfile({
                    chargingProfileId: 42,
                    transactionId: consumptionData.transactionId,
                    message: JSON.stringify(notification)
                  });
                }
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
      };
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
    this[type + 'Value'] = value;
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
    if (this.properties) {
      const props = {};
      this.properties.split('\n').filter(s => s.length > 0)
        .forEach(propString => {
          const array = propString.split(' = ');
          props[array[0]] = array[1];
        });
      this.properties = props;
    }
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

module.exports = ConvergentChargingPricing;
