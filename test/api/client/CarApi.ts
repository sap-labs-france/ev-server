import CrudApi from './utils/CrudApi';
import Constants from './utils/Constants';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.read({ CarCatalogID: id }, '/client/api/CarCatalog');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarCatalogs');
  }

  public async readCarMakers(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarMakers');
  }

  public async readCarImages(id) {
    return super.read({ CarCatalogID: id }, '/client/api/CarCatalogImages');
  }

}
