import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class BillingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async testConnection(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/CheckBillingConnection');
  }

  public async synchronizeUsers(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.create(params, '/client/api/BillingSynchronizeUsers');
  }

  public async synchronizeUser(params?) {
    return await super.create(params, '/client/api/BillingSynchronizeUser');
  }

  public async forceSynchronizeUser(params?) {
    return await super.create(params, '/client/api/BillingForceSynchronizeUser');
  }

  public async synchronizeInvoices(params?) {
    return await super.create(params, '/client/api/BillingSynchronizeInvoices');
  }

  public async synchronizeUserInvoices(params?) {
    return await super.create(params, '/client/api/BillingSynchronizeUserInvoices');
  }
}
