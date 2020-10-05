import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readCarCatalog(id) {
    return super.read({ ID: id }, '/client/api/CarCatalog');
  }

  public async readCarCatalogs(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarCatalogs');
  }

  public async readCarMakers(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarMakers');
  }

  public async readCarImages(id) {
    return super.read({ ID: id }, '/client/api/CarCatalogImages');
  }

  public async readCar(id) {
    return super.read({ ID: id }, '/client/api/Car');
  }

  public async readCars(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Cars');
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

  public async readCarUsers(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarUsers');
  }

}
