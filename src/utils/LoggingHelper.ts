import ChargingStation from '../types/ChargingStation';
import { Log } from '../types/Log';
import Transaction from '../types/Transaction';

export default class LoggingHelper {

  public static getTransactionProperties(transaction: Transaction): Partial<Log> {
    return {
      siteID: transaction.siteID,
      siteAreaID: transaction.siteAreaID,
      companyID: transaction.companyID,
      chargingStationID: transaction.chargeBoxID,
      actionOnUser: transaction.user,
    };
  }

  public static getChargingStationProperties(chargingStation: ChargingStation): { siteID: string; siteAreaID: string; companyID: string; chargingStationID: string; } {
    return {
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      chargingStationID: chargingStation.id,
    };
  }
}
