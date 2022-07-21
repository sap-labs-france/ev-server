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
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_INVOICES));
  }

  public async readInvoice(id: string) {
    return super.read({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_INVOICE, { invoiceID: id }));
  }

  public async createBillingAccount(params) {
    return super.create(params, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNTS));
  }

  public async refreshBillingAccount(params) {
    return super.patch(params, super.buildUtilRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNT_REFRESH, { id: params.accountID }));
  }

  public async activateBillingAccount(params) {
    return super.patch(params, super.buildUtilRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNT_ACTIVATE, { id: params.accountID }));
  }

  public async readBillingAccounts(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNTS));
  }

  public async readBillingAccount(id: string) {
    return super.read({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNT, { id }));
  }

  public async onboardBillingAccount(id: string) {
    return super.patch({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_ACCOUNT_ONBOARD, { id }));
  }

  public async readTransfers(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_TRANSFERS));
  }

  public async readTransfer(id: string) {
    return super.read({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_TRANSFER, { id }));
  }

  public async finalizeTransfer(id) {
    return super.patch({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_TRANSFER_FINALIZE, { id }));
  }

  public async sendTransfer(id) {
    return super.patch({}, super.buildRestEndpointUrl(RESTServerRoute.REST_BILLING_TRANSFER_SEND, { id }));
  }
}
