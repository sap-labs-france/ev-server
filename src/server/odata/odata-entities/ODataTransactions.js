const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataTransactions extends AbstractODataEntities {

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

  // Custom convert to:
  //   - add startDate and stopDate objects
  //   - shorten stop price to 15 in order to be compatible with Edm.Double
  static convert(object, req) {
    const transaction = super.convert(object, req);
    if (transaction.hasOwnProperty('timestamp') && transaction.timestamp) {
      // convert timestamp and build date object
      transaction.timestamp = this.convertTimestamp(transaction.timestamp, req);
      transaction.startDate = this.buildDateObject(transaction.timestamp, req);
    }

    // rename User
    if (transaction.user) {
      transaction.startUser = transaction.user;
      transaction.startUser.fullName = `${transaction.startUser.name}, ${transaction.startUser.firstName}`;
      delete transaction['user'];
    }

    // rename TagID
    if (transaction.hasOwnProperty('tagID')) {
      transaction.startTagID = transaction.tagID;
      delete transaction['tagID'];
    }

    if (transaction.stop) {
      if (transaction.stop.hasOwnProperty('timestamp') && transaction.stop.timestamp) {
        // convert timestamp and build date object
        transaction.stop.timestamp = this.convertTimestamp(transaction.stop.timestamp, req);
        transaction.stopDate = this.buildDateObject(transaction.stop.timestamp, req);
      }

      // rename User and move to transaction root
      if (transaction.stop.user) {
        transaction.stopUser = transaction.stop.user;
        transaction.stopUser.fullName = `${transaction.stopUser.name}, ${transaction.stopUser.firstName}`;
        delete transaction.stop['user'];
      }

      // rename TagID and move to transaction root
      if (transaction.stop.hasOwnProperty('tagID')) {
        transaction.stopTagID = transaction.stop.tagID;
        delete transaction.stop['tagID'];
      }

      if (transaction.stop.hasOwnProperty('price')) {
        transaction.stop.price = transaction.stop.price.toFixed(15)
      }
    }
    return transaction;
  }

  // TODO: to be deleted - kept in order to be compatible with old model in SAC
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

}


module.exports = ODataTransactions;