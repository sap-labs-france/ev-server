// pragma import moment from 'moment';
import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return await super.readById(id, '/client/api/Transaction');
  }

  public async readAllActive(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsActive');
  }

  public async readAllCompleted(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsCompleted');
  }

  public async readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsInError');
  }

  public async readAllConsumption(params) {
    return await super.read(params, '/client/api/ConsumptionFromTransaction');
  }

  public async readAllYears(params) {
    return await super.readAll(params, Constants.DEFAULT_PAGING, Constants.DEFAULT_ORDERING, '/client/api/TransactionYears');
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
    return await super.readAll(params, Constants.DEFAULT_PAGING, Constants.DEFAULT_ORDERING, '/client/api/TransactionsToRefund');
  }

  public async readAllRefundReports(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TransactionsRefundReports');
  }

  public async exportTransactionsToRefund(params) {
    return await super.read(params, '/client/api/TransactionsToRefundExport');
  }

}
