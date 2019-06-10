
import AbstractODataEntities from './AbstractODataEntities';
export default class ODataStatusNotifications extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;
  public convertTimestamp: any;
  public buildDateObject: any;

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

    // add count property - this is necessary for SAC as it needs at least one numeric measure
    statusNotification.count = 1;

    return statusNotification;
  }
}


