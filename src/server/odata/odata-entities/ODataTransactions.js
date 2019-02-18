
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
      transaction.timestamp = transaction.timestamp.split('.')[0] + "Z";

      // convert timestamp and build date object
      transaction.timestamp = this.convertTimestamp(transaction.timestamp, req);
      transaction.startDate = this.buildDateObject(transaction.timestamp, req);
    }

    if (transaction.hasOwnProperty('stop')) {
      if (transaction.stop.hasOwnProperty('timestamp') && transaction.stop.timestamp) {
        transaction.stop.timestamp = transaction.stop.timestamp.split('.')[0] + "Z";

        // convert timestamp and build date object
        transaction.stop.timestamp = this.convertTimestamp(transaction.stop.timestamp, req);
        transaction.stop.stopDate = this.buildDateObject(transaction.stop.timestamp,req);
      }

      if (transaction.stop.hasOwnProperty('price')) {
        transaction.stop.price = transaction.stop.price.toFixed(15)
      }
    }
    return transaction;
  }
}


module.exports = ODataTransactions;