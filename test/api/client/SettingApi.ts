import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class SettingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/Setting');
  }

  public async readAll(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Settings');
  }

  public async create(data) {
    return super.create(data, '/client/api/SettingCreate');
  }

  public async update(data) {
    return super.update(data, '/client/api/SettingUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/SettingDelete');
  }
}

