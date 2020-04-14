import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class AssetApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Asset');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Assets');
  }

  public create(data) {
    return super.create(data, '/client/api/AssetCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/AssetUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/AssetDelete');
  }
}
