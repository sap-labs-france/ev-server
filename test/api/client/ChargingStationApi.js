const ReadApi = require('./utils/ReadApi');
const UpdateApi = require('./utils/UpdateApi');
const Constants = require('./utils/Constants')

class TransactionApi {

  constructor(baseApi) {
    this.readApi = new ReadApi(baseApi);
    this.updateApi = new UpdateApi(baseApi);
  }

  readById(id) {
    return this.readApi.readById('/client/api/ChargingStation/', id);
  }

  readConfiguration(chargeBoxID) {
    return this.readApi.read('/client/api/ChargingStationConfiguration/', {ChargeBoxID: chargeBoxID});
  }

  readConsumptionStatistics(year) {
    return this.readApi.read('/client/api/ChargingStationConsumptionStatistics/', {Year: year});
  }

  readUsageStatistics(year) {
    return this.readApi.read('/client/api/ChargingStationUsageStatistics/', {Year: year});
  }

  readAll(params) {
    return this.readApi.readAll('/client/api/ChargingStations/', params);
  }

  readAllTransactions(params) {
    return this.readApi.readAll('/client/api/ChargingStationTransactions/', params);
  }

  readAllYears(params) {
    return this.readApi.readAll('/client/api/TransactionYears/', params);
  }

  updateParams(data) {
    return this.updateApi.update('/client/api/ChargingStationUpdateParams/', data);
  }



}

module.exports = TransactionApi;