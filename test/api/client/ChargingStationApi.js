const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class ChargingStationApi  extends CrudApi {

  constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // Keep it
    this.baseApi = baseApi;
  }

  readById(id) {
    return super.readById('/client/api/ChargingStation', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/ChargingStations', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/ChargingStationCreate', data);
  }

  update(data) {
    return super.update('/client/api/ChargingStationUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/ChargingStationDelete', id);
  }

  readConfiguration(chargeBoxID) {
    return this.readApi.read('/client/api/ChargingStationConfiguration', { ChargeBoxID: chargeBoxID });
  }

  readConsumptionStatistics(year) {
    return this.readApi.read('/client/api/ChargingStationConsumptionStatistics', { Year: year });
  }

  readUsageStatistics(year) {
    return this.readApi.read('/client/api/ChargingStationUsageStatistics', { Year: year });
  }

  readAllTransactions(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/ChargingStationTransactions', params, paging, ordering);
  }

  readAllYears(params) {
    return this.readApi.readAll('/client/api/TransactionYears', params);
  }

  updateParams(data) {
    return super.update('/client/api/ChargingStationUpdateParams', data);
  }
}

module.exports = ChargingStationApi;