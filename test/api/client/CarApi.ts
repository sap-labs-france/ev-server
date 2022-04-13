import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import { Car } from '../../../src/types/Car';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readCarCatalog(id: number) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR_CATALOG, { id }));
  }

  public async readCarCatalogs(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR_CATALOGS));
  }

  public async readCarMakers(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR_MAKERS));
  }

  public async readCarImages(id: number) {
    return super.readAll({ ID: id }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR_CATALOG_IMAGES, { id }));
  }

  public async readCar(id: string) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR, { id }));
  }

  public async readCars(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_CARS));
  }

  public async update(data: Car) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR, { id: data.id }));
  }

  public async create(data: Car) {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_CARS));
  }

  public async delete(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_CAR, { id }));
  }
}
