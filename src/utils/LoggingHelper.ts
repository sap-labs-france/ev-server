import { Log } from '../types/Log';
import Transaction from '../types/Transaction';

export default class LoggingHelper {

  public static getSessionProperties(transaction: Transaction): Partial<Log> {
    return {
      siteID: transaction.siteID,
      siteAreaID: transaction.siteAreaID,
      companyID: transaction.companyID,
      chargingStationID: transaction.chargeBoxID,
      source: transaction.chargeBoxID,
      actionOnUser: transaction.user,
    };
  }
}
