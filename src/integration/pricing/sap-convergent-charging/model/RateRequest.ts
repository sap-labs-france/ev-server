export class StartRateRequest {
  public reservationItem: any;
  public sessionID: any;
  public consumptionDate: any;
  public serviceId: any;
  public userTechnicalId: any;
  public defaultResolution: any;
  public timeToLive: any;
  public resultType: any;
  public filterTransaction: any;
  public cleanupResultType: any;
  public propertyToInverse: any;

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

export class UpdateRateRequest {
  public confirmationItem: any;
  public reservationItem: any;
  public sessionID: any;
  public consumptionDate: any;
  public serviceId: any;
  public userTechnicalId: any;
  public resultType: any;
  public filterTransaction: any;
  public cleanupResultType: any;

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

export class StopRateRequest {
  public confirmationItem: any;
  public sessionID: any;
  public serviceId: any;
  public userTechnicalId: any;
  public resolution: any;
  public resultType: any;
  public filterTransaction: any;
  public cleanupResultType: any;

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
