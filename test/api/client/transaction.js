const ReadApi = require('./utils/readApi');

class TransactionApi {

  constructor(baseApi) {
    this.readApi = new ReadApi(baseApi);
  }

  readById(id, expectations) {
    return this.readApi.readById('/client/api/Transaction/', id, expectations);
  }

  readAllActive(query, expectations) {
    return this.readApi.readAll('/client/api/TransactionsActive/', query, expectations);
  }

  readAllCompleted(query, expectations) {
    return this.readApi.readAll('/client/api/TransactionsCompleted/', query, expectations);
  }

  readAllYears(query, expectations) {
    return this.readApi.readAll('/client/api/TransactionYears/', query, expectations);
  }

}

module.exports = TransactionApi;