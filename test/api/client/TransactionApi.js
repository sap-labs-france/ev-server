const ReadApi = require('./utils/ReadApi');
const Constants = require('./utils/Constants')

class TransactionApi {

  constructor(baseApi) {
    this.readApi = new ReadApi(baseApi);
  }

  readById(id) {
    return this.readApi.readById('/client/api/Transaction/', id);
  }

  readAllActive(params) {
    return this.readApi.readAll('/client/api/TransactionsActive/', params);
  }

  readAllCompleted(params) {
    return this.readApi.readAll('/client/api/TransactionsCompleted/', params);
  }

  readAllYears(params) {
    return this.readApi.readAll('/client/api/TransactionYears/', params);
  }

}

module.exports = TransactionApi;