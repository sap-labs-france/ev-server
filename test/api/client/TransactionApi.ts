// pragma import moment from 'moment';
import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';
import User from '../../../src/types/User';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Transaction');
  }

  public readAllActive(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsActive');
  }

  public readAllCompleted(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsCompleted');
  }

  public readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsInError');
  }

  public readAllConsumption(params) {
    return super.read(params, '/client/api/ConsumptionFromTransaction');
  }

  public readAllYears(params) {
    return super.readAll(params, Constants.DEFAULT_PAGING, Constants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public delete(id) {
    return super.delete(id, '/client/api/TransactionDelete');
  }

  public readAllRefundReports(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsRefundReports');
  }

}
