import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class UserApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/User');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Users');
  }

  public async readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/UsersInError');
  }

  public async create(data) {
    return super.create(data, '/client/api/UserCreate');
  }

  public async update(data) {
    return super.update(data, '/client/api/UserUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/UserDelete');
  }

  public async getByEmail(email) {
    return this.readAll({ Search : email });
  }

  public async getByTag(tag) {
    return this.readAll({ Search : tag });
  }
}
