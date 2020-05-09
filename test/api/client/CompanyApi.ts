import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class CompanyApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/Company');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Companies');
  }

  public async create(data) {
    return super.create(data, '/client/api/CompanyCreate');
  }

  public async update(data) {
    return super.update(data, '/client/api/CompanyUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/CompanyDelete');
  }
}

