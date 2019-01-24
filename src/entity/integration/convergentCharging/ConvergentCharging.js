const StatefulChargingService = require('./StatefulChargingService');
const SettingStorage = require("../../../storage/mongodb/SettingStorage");

class ConvergentCharging {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async initialize() {
    if (!this.setting) {
      this.setting = await SettingStorage.getSettingByIdentifier(this.tenantId, 'pricing');
      this.setting = this.setting.getContent()['convergentCharging'];
      this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, this.setting.password);
    }
  }

  /**
   * @param transaction {Transaction}
   */
  async startTransaction(transaction) {
    await this.initialize();
    const reservationItem = new ReservationItem('', [new ChargeableItemProperty('consumption', Type.number, transaction.getCurrentConsumption())]);

    const startRateRequest = new StartRateRequest(reservationItem, transaction.getID(), transaction.getStartDate(), transaction.getChargeBoxID(), transaction.getUserID());
    await this.statefulChargingService.execute(startRateRequest);
  }

  /**
   * @param transaction {Transaction}
   */
  async updateTransaction(transaction) {
    await this.initialize();
    const confirmationItem = new ConfirmationItem('', [new ChargeableItemProperty('consumption', Type.number, transaction.getCurrentConsumption())]);
    const reservationItem = new ReservationItem('', [new ChargeableItemProperty('consumption', Type.number, transaction.getCurrentConsumption())]);

    const request = new UpdateRateRequest(confirmationItem, reservationItem, transaction.getID(), transaction.getStartDate(), transaction.getChargeBoxID(), transaction.getUserID());
    await this.statefulChargingService.execute(request);
  }

  /**
   * @param transaction {Transaction}
   */
  async stopTransaction(transaction) {
    await this.initialize();
    const confirmationItem = new ConfirmationItem('', [new ChargeableItemProperty('consumption', Type.number, transaction.getCurrentConsumption())]);

    const request = new StopRateRequest(confirmationItem, transaction.getID(), transaction.getStartDate(), transaction.getChargeBoxID(), transaction.getUserID());
    await this.statefulChargingService.execute(request);
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

class StartRateResult {
  constructor(amountToConfirm, amountToReserve, transactionSetID, limit) {
    this.amountToConfirm = amountToConfirm;
    this.amountToReserve = amountToReserve;
    this.transactionSetID = transactionSetID;
    this.limit = limit;
  }
}

class UpdateRateResult {
  constructor(amountToConfirm, amountToReserve, amountToCancel, accumulatedAmount, limit) {
    this.amountToConfirm = amountToConfirm;
    this.amountToReserve = amountToReserve;
    this.amountToCancel = amountToCancel;
    this.accumulatedAmount = accumulatedAmount;
    this.limit = limit;
  }
}

class StopRateResult {
  constructor(amountToConfirm, amountToCancel, accumulatedAmount) {
    this.amountToConfirm = amountToConfirm;
    this.amountToCancel = amountToCancel;
    this.accumulatedAmount = accumulatedAmount;
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
    return 'updateRate';
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
    return 'stopRate';
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

module.exports = ConvergentCharging;