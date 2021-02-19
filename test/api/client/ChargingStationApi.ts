import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';
import { expect } from 'chai';

export default class ChargingStationApi extends CrudApi {

  private _baseApi;

  public constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // Keep it
    this._baseApi = baseApi;
  }

  public async readById(id) {
    return super.read({}, `/v1/api/chargingstations/${id}`);
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/v1/api/chargingstations');
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/v1/api/chargingstations/in-error');
  }

  public async update(data) {
    return super.update(data, '/v1/api/chargingstations/parameters');
  }

  public async delete(id) {
    return super.delete(id, '/v1/api/chargingstations');
  }

  public async readConsumptionStatistics(year) {
    return super.read({ Year: year }, '/client/api/ChargingStationConsumptionStatistics');
  }

  public async readUsageStatistics(year) {
    return super.read({ Year: year }, '/client/api/ChargingStationUsageStatistics');
  }

  public async readAllTransactions(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, `/v1/api/chargingstations/${params.id}/transactions`);
  }

  public async readAllYears(params) {
    return super.readAll(params, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public async remoteStartTransaction(data) {
    return super.update(data, '/v1/api/chargingstations/remote/start');
  }

  public async checkConnector(chargingStation, connectorId, connectorData) {
    // Check
    expect(chargingStation).to.not.be.null;
    // Always remove the timestamp
    delete connectorData.timestamp;
    // Retrieve it from the backend
    const response = await this.readById(chargingStation.id);
    // Check if ok
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(chargingStation.id);
    // Check Connector
    const foundChargingStation = response.data;
    // Check
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[connectorId - 1]).to.include(connectorData);
  }
}
