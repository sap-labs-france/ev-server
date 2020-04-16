import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class SettingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Setting');
  }

  public readAll(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Settings');
  }

  public create(data) {
    return super.create(data, '/client/api/SettingCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/SettingUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/SettingDelete');
  }
}

