import Asset from '../../../src/types/Asset';
import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class AssetApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id: string): Promise<any> {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSET, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING): Promise<any> {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSETS));
  }

  public async create(data: Asset): Promise<any> {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSETS));
  }

  public async update(data: Asset): Promise<any> {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSET, { id: data.id }));
  }

  public async delete(id: string): Promise<any> {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSET, { id }));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING): Promise<any> {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSETS_IN_ERROR));
  }

  public async checkAssetConnectorLink(id: string): Promise<any> {
    return super.read(id, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSET_CHECK_CONNECTION, { id }));
  }

  public async retrieveLatestConsumption(id: string): Promise<any> {
    return super.read(id, this.buildRestEndpointUrl(RESTServerRoute.REST_ASSET_RETRIEVE_CONSUMPTION, { id }));
  }
}
