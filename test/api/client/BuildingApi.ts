import Constants from "./utils/Constants";
import CrudApi from "./utils/CrudApi";

export default class BuildingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Building');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Buildings');
  }

  public create(data) {
    return super.create(data, '/client/api/BuildingCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/BuildingUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/BuildingDelete');
  }
}
