import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return await super.readById(id, `/v1/api/transactions/${id}`);
  }

  public async readAllActive(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll({ ...params, Status: 'active' }, paging, ordering, `/v1/api/${ServerRoute.REST_TRANSACTIONS}`);
  }

  public async readAllCompleted(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll({ ...params, Status: 'completed' }, paging, ordering, `/v1/api/${ServerRoute.REST_TRANSACTIONS}`);
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsInError');
  }

  public async readAllConsumption(params) {
    return await super.read(params, `/v1/api/transactions/${params.TransactionId}/consumptions`);
  }

  public async readAllYears(params) {
    return await super.readAll(params, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public async delete(id) {
    return await super.delete(id, '/client/api/TransactionDelete');
  }

  public async deleteMany(ids) {
    return await this._authenticatedApi.send({
      method: 'DELETE',
      url: '/client/api/TransactionsDelete',
      data: {
        transactionsIDs: ids,
      }
    });
  }

  public async readAllToRefund(params) {
    return await super.readAll(params, TestConstants.ADVANCED_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/TransactionsToRefund');
  }

  public async readAllRefundReports(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsRefundReports');
  }

  public async exportTransactionsToRefund(params) {
    return await super.read(params, '/client/api/TransactionsToRefundExport');
  }

}
