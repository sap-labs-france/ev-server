import { expect } from 'chai';
import CrudApi from './utils/CrudApi';

export default class StatisticsApi extends CrudApi {

  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public static calculateTotalsPerMonth(record: { [x: string]: number }): number {
    let total = 0;
    for (const key in record) {
      if (key !== 'month' && typeof (record[key]) === 'number') {
        total += record[key];
      }
    }
    return total;
  }

  public static calculateNumberOfItemsPerMonth(record: { [x: string]: number }): number {
    let number = 0;
    for (const key in record) {
      if (key !== 'month') {
        number++;
      }
    }
    return number;
  }

  public readAllYears() {
    return super.read({}, '/client/api/TransactionYears');
  }

  public readChargingStationConsumption(params) {
    return super.read(params, '/client/api/ChargingStationConsumptionStatistics');
  }

  public readUserConsumption(params) {
    return super.read(params, '/client/api/UserConsumptionStatistics');
  }

  public readChargingStationUsage(params) {
    return super.read(params, '/client/api/ChargingStationUsageStatistics');
  }

  public readUserUsage(params) {
    return super.read(params, '/client/api/UserUsageStatistics');
  }

  public readChargingStationInactivity(params) {
    return super.read(params, '/client/api/ChargingStationInactivityStatistics');
  }

  public readUserInactivity(params) {
    return super.read(params, '/client/api/UserInactivityStatistics');
  }

  public readChargingStationTransactions(params) {
    return super.read(params, '/client/api/ChargingStationTransactionsStatistics');
  }

  public readUserTransactions(params) {
    return super.read(params, '/client/api/UserTransactionsStatistics');
  }

  public readChargingStationPricing(params) {
    return super.read(params, '/client/api/ChargingStationPricingStatistics');
  }

  public readUserPricing(params) {
    return super.read(params, '/client/api/UserPricingStatistics');
  }

  public async exportStatistics(params) {
    return await super.read(params, '/client/api/StatisticsExport');
  }

}
