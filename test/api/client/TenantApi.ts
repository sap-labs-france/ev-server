import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import BaseApi from './utils/BaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TenantApi extends CrudApi {
  private _baseApi: BaseApi;
  public constructor(authenticatedApi: AuthenticatedBaseApi, baseApi: BaseApi) {
    super(authenticatedApi);
    // For call without auth
    this._baseApi = baseApi;
  }

  public async readById(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(ServerRoute.REST_TENANT, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TENANTS));
  }

  public async create(data) {
    return super.create(data, this.buildRestEndpointUrl(ServerRoute.REST_TENANTS));
  }

  public async update(data) {
    return super.update(data, this.buildRestEndpointUrl(ServerRoute.REST_TENANT, { id: data.id }));
  }

  public async delete(id: string) {
    return await this._authenticatedApi.send({
      method: 'DELETE',
      url: this.buildRestEndpointUrl(ServerRoute.REST_TENANT, { id }),
      params: {
        forced: true
      }
    });
  }
}
