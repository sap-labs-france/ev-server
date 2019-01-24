
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');

class ODataTransactions {
  static async query(query, req, cb) {
    // check if id is provided
    if (query && query.$filter && query.$filter.hasOwnProperty('_id')) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, query.$filter._id);

      if (transaction) {
        cb(null,  transaction.getModel());
      }
    } else {
      // check limit parameter
      const limit = query.$limit?query.$limit : 0;

      // Get Transactions
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
        { 'withChargeBoxes': false },
        limit, query.$skip, query.$sort);

      // convert
      const transactionsResult = transactions.result.map((transaction) => transaction.getModel());

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