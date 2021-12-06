import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return await super.readById(id, `${this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTION, { id })}?WithUser=true`);
  }

  public async readAllActive(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_ACTIVE));
  }

  public async readAllCompleted(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_COMPLETED));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_IN_ERROR));
  }

  public async readAllConsumption(params) {
    return await super.read(params, `${this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTION_CONSUMPTIONS, { id: params.TransactionId })}?WithUser=true`);
  }

  public async readAllYears(params) {
    return await super.readAll(params, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public async delete(id) {
    return await super.delete(id, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTION, { id }));
  }

  public async deleteMany(ids) {
    return await this._authenticatedApi.send({
      method: 'DELETE',
      url: this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS),
      data: {
        transactionsIDs: ids,
      }
    });
  }

  public async readAllToRefund(params) {
    return await super.readAll(params, TestConstants.ADVANCED_PAGING, TestConstants.DEFAULT_ORDERING, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_REFUND));
  }

  public async readAllRefundReports(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_REFUND_REPORTS));
  }

  public async exportTransactionsToRefund(params) {
    return await super.read(params, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_REFUND_EXPORT));
  }

  public async exportTransactions(params) {
    return await super.read(params, this.buildRestEndpointUrl(ServerRoute.REST_TRANSACTIONS_EXPORT));
  }

}
