import AbstractODataEntities from './AbstractODataEntities';
export default class ODataTransactions extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;
  public convertTimestamp: any;
  public buildDateObject: any;

  static getObjectKey(transaction) {
    return transaction.id;
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
        transaction.stop.price = transaction.stop.price.toFixed(15);
      }
    }
    return transaction;
  }

}


