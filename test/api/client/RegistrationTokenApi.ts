import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class RegistrationTokenApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return await super.readById(id, '/client/api/RegistrationToken');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/RegistrationTokens');
  }

  public async create(data = {}) {
    return await super.create(data, '/client/api/RegistrationTokenCreate');
  }
}
