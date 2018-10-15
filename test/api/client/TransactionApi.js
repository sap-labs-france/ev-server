const ReadApi = require('./utils/ReadApi');

class TransactionApi {

  constructor(baseApi) {
    this.readApi = new ReadApi(baseApi);
  }

  readById(id) {
    return this.readApi.readById('/client/api/Transaction/', id);
  }

  readAllActive(query) {
    return this.readApi.readAll('/client/api/TransactionsActive/', query);
  }

  readAllCompleted(query) {
    return this.readApi.readAll('/client/api/TransactionsCompleted/', query);
  }

  readAllYears(query) {
    return this.readApi.readAll('/client/api/TransactionYears/', query);
  }

}

module.exports = TransactionApi;