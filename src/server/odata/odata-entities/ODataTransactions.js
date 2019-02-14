
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataTransactions extends AbstractODataEntities {
  static async query(query, req, cb) {
    // check if id is provided
    if (query && query.$filter && query.$filter.hasOwnProperty('_id')) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, query.$filter._id);

      if (transaction) {
        cb(null, transaction.getModel());
      }
    } else {
      // check limit parameter
      const limit = query.$limit ? query.$limit : 0;

      // Get Transactions
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
        { 'withChargeBoxes': false },
        limit, query.$skip, query.$sort);

      // convert
      const transactionsResult = transactions.result.map((transaction) => {
        const _transaction = transaction.getModel();
        if (_transaction && _transaction.stop && _transaction.stop.price) {
          _transaction.stop.price = _transaction.stop.price.toFixed(15)
        }
        return _transaction;
      });

      if (query.$inlinecount) {
        cb(null, {
          count: transactions.count,
          value: transactionsResult
        });
      } else {
        cb(null, transactionsResult);
      }
    }
  }

  static async getTransactionsCompleted(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getTransactionsCompleted(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  static convert(transaction) {
    if (transaction.hasOwnProperty('timestamp') && transaction.timestamp) {
      transaction.timestamp = transaction.timestamp.split('.')[0] + "Z";
      transaction.startDate = transaction.timestamp.split('T')[0];
    }

    if (transaction.hasOwnProperty('stop')) {
      if (transaction.stop.hasOwnProperty('timestamp') && transaction.stop.timestamp) {
        transaction.stop.timestamp = transaction.stop.timestamp.split('.')[0] + "Z";
        transaction.stop.stopDate = transaction.stop.timestamp.split('T')[0];
      }

      if (transaction.stop.hasOwnProperty('price')) {
        transaction.stop.price = transaction.stop.price.toFixed(15)
      }
    }
    return transaction;
  }
}


module.exports = ODataTransactions;