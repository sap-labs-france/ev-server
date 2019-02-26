
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataStatusNotifications extends AbstractODataEntities {
  static getObjectKey(statusNotification) {
    return statusNotification._id;
  }

  static async getStatusNotifications(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getStatusNotifications(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  //   - add notificationDate objects
  static convert(object, req) {
    const statusNotification = super.convert(object, req);

    // convert id name
    if (statusNotification.hasOwnProperty('_id')) {
      statusNotification.id = statusNotification._id;
    }

    if (statusNotification.hasOwnProperty('timestamp') && statusNotification.timestamp) {
      // convert timestamp and build date object
      statusNotification.timestamp = this.convertTimestamp(statusNotification.timestamp, req);
      statusNotification.notificationDate = this.buildDateObject(statusNotification.timestamp, req);
    }

    return statusNotification;
  }
}


module.exports = ODataStatusNotifications;