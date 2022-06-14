import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class BillingApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async testConnection() {
    return super.create(null, this.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_CHECK));
  }

  public async synchronizeUsers(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.create(params, '/client/api/BillingSynchronizeUsers');
  }

  public async synchronizeUser(params?) {
    return super.create(params, '/client/api/BillingSynchronizeUser');
  }

  public async forceSynchronizeUser(params?) {
    return super.create(params, '/client/api/BillingForceSynchronizeUser');
  }

  public async synchronizeInvoices(params?) {
    return super.create(params, '/client/api/BillingSynchronizeInvoices');
  }

  public async downloadInvoiceDocument(params?) {
    return super.read(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_DOWNLOAD_INVOICE, params));
  }

  public async getBillingSetting(params?) {
    return super.read(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SETTING, params));
  }

  public async checkBillingConnection(params?) {
    return super.create(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_CHECK, params));
  }

  public async clearBillingTestData(params?) {
    return super.create(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_CLEAR_TEST_DATA, params));
  }

  public async updateBillingSetting(params?) {
    return super.update(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SETTING, params));
  }

  public async readInvoices(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_INVOICES, params));
  }

  public async createSubAccount(params) {
    return super.create(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SUB_ACCOUNTS));
  }

  public async activateSubAccount(params) {
    return super.patch(params, super.buildUtilRestEndpointUrl(RESTServerRoute.REST_BILLING_SUB_ACCOUNT_ACTIVATE, { id: params.accountID }));
  }

  public async readSubAccounts(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SUB_ACCOUNTS));
  }

  public async readSubAccount(id: string) {
    return super.read({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SUB_ACCOUNT, { id }));
  }

  public async sendSubAccountOnboarding(id: string) {
    return super.patch({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_SUB_ACCOUNT_ONBOARD, { id }));
  }
}
