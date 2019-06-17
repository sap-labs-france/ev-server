import CrudApi from './utils/CrudApi';
import Constants from './utils/Constants';
export default class SiteAreaApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/SiteArea');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/SiteAreas');
  }

  public create(data) {
    return super.create(data, '/client/api/SiteAreaCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/SiteAreaUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/SiteAreaDelete');
  }
}
