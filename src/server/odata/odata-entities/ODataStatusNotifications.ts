import AbstractODataEntities from './AbstractODataEntities';
import Utils from '../../../utils/Utils';

export default class ODataStatusNotifications extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;
  public convertTimestamp: any;
  public buildDateObject: any;

  public getObjectKey(statusNotification): string {
    return statusNotification._id;
  }

  public async getStatusNotifications(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getStatusNotifications(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  //   - add notificationDate objects
  public convert(object, req) {
    const statusNotification = super.convert(object, req);
    // Convert id name
    if (Utils.objectHasProperty(statusNotification, '_id')) {
      statusNotification.id = statusNotification._id;
    }
    if (Utils.objectHasProperty(statusNotification, 'timestamp') && statusNotification.timestamp) {
      // Convert timestamp and build date object
      statusNotification.timestamp = this.convertTimestamp(statusNotification.timestamp, req);
      statusNotification.notificationDate = this.buildDateObject(statusNotification.timestamp, req);
    }
    // Add count property - this is necessary for SAC as it needs at least one numeric measure
    statusNotification.count = 1;
    return statusNotification;
  }
}
