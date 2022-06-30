import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class ChargingStationTemplateApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TEMPLATE, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TEMPLATES));
  }

  public async create(data: Partial<ChargingStationTemplateApi>) {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TEMPLATES));
  }

  public async update(data) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TEMPLATE, { id: data.id }));
  }

  public async delete(id) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_CHARGING_STATION_TEMPLATE, { id }));
  }

}
