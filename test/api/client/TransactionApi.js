const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class TransactionApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Transaction', id);
  }

  readAllActive(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/TransactionsActive', params, paging, ordering);
  }

  readAllCompleted(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/TransactionsCompleted', params, paging, ordering);
  }

  readAllYears(params) {
    return super.readAll('/client/api/TransactionYears', params);
  }

  delete(id) {
    return super.delete('/client/api/TransactionDelete', id);
  }
}

module.exports = TransactionApi;