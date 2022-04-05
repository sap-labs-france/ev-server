import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';

export default class StatisticsApi extends CrudApi {

  public constructor(authenticatedApi: AuthenticatedBaseApi) {
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
    let numberOfItems = 0;
    for (const key in record) {
      if (key !== 'month') {
        numberOfItems++;
      }
    }
    return numberOfItems;
  }

  public async readAllYears() {
    return super.read({}, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTION_YEARS));
  }

  public async readChargingStationConsumption(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_CONSUMPTION_STATISTICS));
  }

  public async readUserConsumption(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USER_CONSUMPTION_STATISTICS));
  }

  public async readChargingStationUsage(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_USAGE_STATISTICS));
  }

  public async readUserUsage(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USER_USAGE_STATISTICS));
  }

  public async readChargingStationInactivity(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_INACTIVITY_STATISTICS));
  }

  public async readUserInactivity(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USER_INACTIVITY_STATISTICS));
  }

  public async readChargingStationTransactions(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TRANSACTIONS_STATISTICS));
  }

  public async readUserTransactions(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USER_TRANSACTIONS_STATISTICS));
  }

  public async readChargingStationPricing(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_PRICING_STATISTICS));
  }

  public async readUserPricing(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USER_PRICING_STATISTICS));
  }

  public async exportStatistics(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_STATISTICS_EXPORT));
  }

}
