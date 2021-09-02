import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readCarCatalog(id: number) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(ServerRoute.REST_CAR_CATALOG, { id }));
  }

  public async readCarCatalogs(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_CAR_CATALOGS));
  }

  public async readCarMakers(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_CAR_MAKERS));
  }

  public async readCarImages(id: number) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(ServerRoute.REST_CAR_CATALOG_IMAGES, { id }));
  }

  public async readCar(id: string) {
    return super.read({ ID: id }, '/client/api/Car');
  }

  public async readCars(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_CARS));
  }

  public async update(data) {
    return super.update(data, '/client/api/CarUpdate');
  }

  public async create(data) {
    return super.create(data, '/client/api/CarCreate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/CarDelete');
  }
}
