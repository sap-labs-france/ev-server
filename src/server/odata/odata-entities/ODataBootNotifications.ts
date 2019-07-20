
import AbstractODataEntities from './AbstractODataEntities';

export default class ODataBootNotifications extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;
  public convertTimestamp: any;
  public buildDateObject: any;

  static getObjectKey(bootNotification) {
    return bootNotification._id;
  }

  static async getBootNotifications(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = ODataBootNotifications.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getBootNotifications(params);
      // Return response
      ODataBootNotifications.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  //   - add bootDate objects
  static convert(object, req) {
    const bootNotification = super.convert(object, req);
    // Convert id name
    if (bootNotification.hasOwnProperty('_id')) {
      bootNotification.id = bootNotification._id;
    }
    if (bootNotification.hasOwnProperty('timestamp') && bootNotification.timestamp) {
      // Convert timestamp and build date object
      bootNotification.timestamp = ODataBootNotifications.convertTimestamp(bootNotification.timestamp, req);
      bootNotification.bootDate = ODataBootNotifications.buildDateObject(bootNotification.timestamp, req);
    }
    // Add count property - this is necessary for SAC as it needs at least one numeric measure
    bootNotification.count = 1;
    return bootNotification;
  }
}

