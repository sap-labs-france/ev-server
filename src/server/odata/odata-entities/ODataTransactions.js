
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');

class ODataTransactions {
  static async query(query, req, cb) {
    // Get Transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      { 'withChargeBoxes': false },
      query.$limit, query.$skip, query.$sort);

    // convert
    const transactionsResult = transactions.result.map((transaction) => transaction.getModel());

    cb(null, transactionsResult);
    // transactionsResult.toArray(cb);
  }
}


module.exports = ODataTransactions;