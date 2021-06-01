import AbstractODataEntities from './AbstractODataEntities';
import Utils from '../../../utils/Utils';

export default class ODataBootNotifications extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;
  public convertTimestamp: any;
  public buildDateObject: any;

  public getObjectKey(bootNotification): string {
    return bootNotification._id;
  }

  public async getBootNotifications(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getBootNotifications(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  //   - add bootDate objects
  public convert(object, req) {
    const bootNotification = super.convert(object, req);
    // Convert id name
    if (Utils.objectHasProperty(bootNotification, '_id')) {
      bootNotification.id = bootNotification._id;
    }
    if (Utils.objectHasProperty(bootNotification, 'timestamp') && bootNotification.timestamp) {
      // Convert timestamp and build date object
      bootNotification.timestamp = this.convertTimestamp(bootNotification.timestamp, req);
      bootNotification.bootDate = this.buildDateObject(bootNotification.timestamp, req);
    }
    // Add count property - this is necessary for SAC as it needs at least one numeric measure
    bootNotification.count = 1;
    return bootNotification;
  }
}

