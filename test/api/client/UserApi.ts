import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class UserApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/User');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Users');
  }

  public readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/UsersInError');
  }

  public create(data) {
    return super.create(data, '/client/api/UserCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/UserUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/UserDelete');
  }

  public getByEmail(email) {
    return this.readAll({ Search : email });
  }

  public getByTag(tag) {
    return this.readAll({ Search : tag });
  }
}
