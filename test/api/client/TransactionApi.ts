import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, `${this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTION, { id })}?WithUser=true`);
  }

  public async readAllActive(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_ACTIVE));
  }

  public async readAllCompleted(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_COMPLETED));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_IN_ERROR));
  }

  public async readAllConsumption(params) {
    const id = params.TransactionId;
    return super.read(params, `${this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTION_CONSUMPTIONS, { id })}?WithUser=true&LoadAllConsumptions=true`);
  }

  public async readAllYears(params) {
    return super.readAll(params, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public async delete(id) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTION, { id }));
  }

  public async deleteMany(ids) {
    return this._authenticatedApi.send({
      method: 'DELETE',
      url: this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS),
      data: {
        transactionsIDs: ids,
      }
    });
  }

  public async readAllToRefund(params) {
    return super.readAll(params, TestConstants.ADVANCED_PAGING, TestConstants.DEFAULT_ORDERING, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_REFUND));
  }

  public async readAllRefundReports(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_REFUND_REPORTS));
  }

  public async exportTransactionsToRefund(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_REFUND_EXPORT));
  }

  public async exportTransactions(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTIONS_EXPORT));
  }

  public async softStopTransaction(params) {
    return super.update(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TRANSACTION_SOFT_STOP, { id: params.ID }));
  }
}
