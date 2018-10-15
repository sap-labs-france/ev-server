const ReadApi = require('./utils/ReadApi');
const UpdateApi = require('./utils/UpdateApi');

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

  readAll(query) {
    return this.readApi.readAll('/client/api/ChargingStations/', query);
  }

  readAllTransactions(query) {
    return this.readApi.readAll('/client/api/ChargingStationTransactions/', query);
  }

  readAllYears(query) {
    return this.readApi.readAll('/client/api/TransactionYears/', query);
  }

  updateParams(data) {
    return this.updateApi.update('/client/api/ChargingStationUpdateParams/', data);
  }



}

module.exports = TransactionApi;