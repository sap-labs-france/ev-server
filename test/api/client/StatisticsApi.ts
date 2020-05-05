import CrudApi from './utils/CrudApi';
import { expect } from 'chai';

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

  public async readAllYears() {
    return super.read({}, '/client/api/TransactionYears');
  }

  public async readChargingStationConsumption(params) {
    return super.read(params, '/client/api/ChargingStationConsumptionStatistics');
  }

  public async readUserConsumption(params) {
    return super.read(params, '/client/api/UserConsumptionStatistics');
  }

  public async readChargingStationUsage(params) {
    return super.read(params, '/client/api/ChargingStationUsageStatistics');
  }

  public async readUserUsage(params) {
    return super.read(params, '/client/api/UserUsageStatistics');
  }

  public async readChargingStationInactivity(params) {
    return super.read(params, '/client/api/ChargingStationInactivityStatistics');
  }

  public async readUserInactivity(params) {
    return super.read(params, '/client/api/UserInactivityStatistics');
  }

  public async readChargingStationTransactions(params) {
    return super.read(params, '/client/api/ChargingStationTransactionsStatistics');
  }

  public async readUserTransactions(params) {
    return super.read(params, '/client/api/UserTransactionsStatistics');
  }

  public async readChargingStationPricing(params) {
    return super.read(params, '/client/api/ChargingStationPricingStatistics');
  }

  public async readUserPricing(params) {
    return super.read(params, '/client/api/UserPricingStatistics');
  }

  public async exportStatistics(params) {
    return await super.read(params, '/client/api/StatisticsExport');
  }

}
