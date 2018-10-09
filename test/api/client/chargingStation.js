const ReadApi = require('./utils/readApi');
const UpdateApi = require('./utils/updateApi');

class TransactionApi {

  constructor(baseApi) {
    this.readApi = new ReadApi(baseApi);
    this.updateApi = new UpdateApi(baseApi);
  }

  readById(id, expectations) {
    return this.readApi.readById('/client/api/ChargingStation/', id, expectations);
  }

  readConfiguration(chargeBoxID, expectations) {
    return this.readApi.read('/client/api/ChargingStationConfiguration/', {ChargeBoxID: chargeBoxID}, expectations);
  }

  readConsumptionStatistics(year, expectations) {
    return this.readApi.read('/client/api/ChargingStationConsumptionStatistics/', {Year: year}, expectations);
  }

  readUsageStatistics(year, expectations) {
    return this.readApi.read('/client/api/ChargingStationUsageStatistics/', {Year: year}, expectations);
  }

  readAll(query, expectations) {
    return this.readApi.readAll('/client/api/ChargingStations/', query, expectations);
  }

  readAllTransactions(query, expectations) {
    return this.readApi.readAll('/client/api/ChargingStationTransactions/', query, expectations);
  }

  readAllYears(query, expectations) {
    return this.readApi.readAll('/client/api/TransactionYears/', query, expectations);
  }

  updateParams(payload, expectations) {
    return this.updateApi.update('/client/api/ChargingStationUpdateParams/', payload, expectations);
  }



}

module.exports = TransactionApi;