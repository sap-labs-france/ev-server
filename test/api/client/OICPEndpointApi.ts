import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import OCPIEndpoint from '../../../src/types/ocpi/OCPIEndpoint';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class OICPEndpointApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINTS));
  }

  public async create(data: OCPIEndpoint) {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINTS));
  }

  public async update(data: OCPIEndpoint) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT, { id: data.id }));
  }

  public async delete(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT, { id }));
  }

  public async register(id: string) {
    return super.update(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT_REGISTER, { id }));
  }

  public async unregister(id: string) {
    return super.update(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT_UNREGISTER, { id }));
  }

  public async sendEvseStatuses(id: string) {
    return super.update(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT_SEND_EVSE_STATUSES, { id }));
  }

  public async sendEvses(id: string) {
    return super.update(id, this.buildRestEndpointUrl(RESTServerRoute.REST_OICP_ENDPOINT_SEND_EVSES, { id }));
  }
}
