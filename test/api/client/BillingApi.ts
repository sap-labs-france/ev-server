import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class BillingApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
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

  public async getBillingSettings(params?) {
    // return await super.read(params, '/v1/api/billing-settings');
    return await super.read(params, super.buildRestEndpointUrl(ServerRoute.REST_BILLING_SETTINGS, {}));
  }

  public async getBillingSetting(id, params?) {
    return await super.read(params, super.buildRestEndpointUrl(ServerRoute.REST_BILLING_SETTING, { id }));
  }

  public async checkBillingSettingConnection(id, params?) {
    return await super.create(params, super.buildRestEndpointUrl(ServerRoute.REST_BILLING_SETTING_CHECK_CONNECTION, { id }));
  }

  public async checkBillingSetting(id, params?) {
    return await super.create(params, super.buildRestEndpointUrl(ServerRoute.REST_BILLING_SETTING_CHECK, { id }));
  }

  public async activateBillingSetting(id, params?) {
    return await super.create(params, super.buildRestEndpointUrl(ServerRoute.REST_BILLING_SETTING_ACTIVATE, { id }));
  }

}
