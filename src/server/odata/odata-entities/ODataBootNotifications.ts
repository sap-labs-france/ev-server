
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

    // add count property - this is necessary for SAC as it needs at least one numeric measure
    bootNotification.count = 1;

    return bootNotification;
  }
}


