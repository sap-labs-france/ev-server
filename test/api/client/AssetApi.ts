import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class AssetApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id): Promise<any> {
    return super.readById(id, '/client/api/Asset');
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING): Promise<any> {
    return super.readAll(params, paging, ordering, '/client/api/Assets');
  }

  public async create(data): Promise<any> {
    return super.create(data, '/client/api/AssetCreate');
  }

  public async update(data: Promise<any>) {
    return super.update(data, '/client/api/AssetUpdate');
  }

  public async delete(id): Promise<any> {
    return super.delete(id, '/client/api/AssetDelete');
  }
}
