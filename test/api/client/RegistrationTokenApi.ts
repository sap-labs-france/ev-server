import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class RegistrationTokenApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return await super.readById(id, '/client/api/RegistrationToken');
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/RegistrationTokens');
  }

  public async create(data = {}) {
    return await super.create(data, '/client/api/RegistrationTokenCreate');
  }
}
