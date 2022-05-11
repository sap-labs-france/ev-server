import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import { StatusCodes } from 'http-status-codes';
import TestConstants from './utils/TestConstants';
import { expect } from 'chai';

export default class ChargingStationTemplateApi extends CrudApi {
  private _baseApi;

  public constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // Keep it
    this._baseApi = baseApi;
  }

  public async readById(id) {
    return super.read({}, `/v1/api/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATES}/${id}`);
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, `/v1/api/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATES}`);
  }

  public async checkConnector(chargingStation, connectorId, connectorData) {
    expect(chargingStation).to.not.be.null;
    // Always remove the timestamp
    delete connectorData.timestamp;
    // Retrieve it from the backend
    const response = await this.readById(chargingStation.id);
    // Check if ok
    expect(response.status).to.equal(StatusCodes.OK);
    expect(response.data.id).is.eql(chargingStation.id);
    // Check Connector
    const foundChargingStationTemplate = response.data;
    expect(foundChargingStationTemplate.connectors).to.not.be.null;
    expect(foundChargingStationTemplate.connectors[connectorId - 1]).to.include(connectorData);
  }
}
