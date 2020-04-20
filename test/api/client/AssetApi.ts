import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class AssetApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/Asset');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Assets');
  }

  public async create(data) {
    return super.create(data, '/client/api/AssetCreate');
  }

  public async update(data) {
    return super.update(data, '/client/api/AssetUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/AssetDelete');
  }
}
