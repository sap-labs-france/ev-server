import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class BillingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async testConnection(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/CheckBillingConnection');
  }

  public async synchronizeUsers(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
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

  public async downloadInvoiceDocument(params?) {
    return await super.read(params, '/client/api/BillingDownloadInvoice');
  }
}
