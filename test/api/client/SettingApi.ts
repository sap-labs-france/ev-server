import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class SettingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {console.log('ByID setting');
    return super.readById(id, '/client/api/Setting');
  }

  public readAll(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Settings');
  }

  public create(data) {console.log('create setting');
    return super.create(data, '/client/api/SettingCreate');
  }

  public update(data) {console.log('update setting');
    return super.update(data, '/client/api/SettingUpdate');
  }

  public delete(id) {console.log('delete setting');
    return super.delete(id, '/client/api/SettingDelete');
  }
}

