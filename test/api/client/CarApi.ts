import CrudApi from './utils/CrudApi';
import Constants from './utils/Constants';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }
  public readById(id) {
    return super.readById(id, '/client/api/Car');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Cars');
  }
}
