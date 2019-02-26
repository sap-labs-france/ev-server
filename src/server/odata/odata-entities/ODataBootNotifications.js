
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataBootNotifications extends AbstractODataEntities {
  static getObjectKey(bootNotification) {
    return bootNotification._id;
  }

  static async getBootNotifications(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getBootNotifications(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  //   - add bootDate objects
  static convert(object, req) {
    const bootNotification = super.convert(object, req);

    // convert id name
    if (bootNotification.hasOwnProperty('_id')) {
      bootNotification.id = bootNotification._id;
    }

    if (bootNotification.hasOwnProperty('timestamp') && bootNotification.timestamp) {
      // convert timestamp and build date object
      bootNotification.timestamp = this.convertTimestamp(bootNotification.timestamp, req);
      bootNotification.bootDate = this.buildDateObject(bootNotification.timestamp, req);
    }

    return bootNotification;
  }
}


module.exports = ODataBootNotifications;