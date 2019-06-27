import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class TenantApi extends CrudApi {
  private _baseApi;
  public constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // For call without auth
    this._baseApi = baseApi;
  }

  public readById(id) {
    return super.readById(id, '/client/api/Tenant');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Tenants');
  }

  public create(data) {
    return super.create(data, '/client/api/TenantCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/TenantUpdate');
  }

  public delete(id) {
    return this._authenticatedApi.send({
      method: 'DELETE',
      url: '/client/api/TenantDelete',
      params: {
        ID: id,
        forced: true
      }
    });
  }
}
