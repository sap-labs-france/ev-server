import { HttpEndUserReportErrorRequest, HttpNotificationRequest } from '../../../../types/requests/HttpNotificationRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class NotificationValidator extends SchemaValidator {
  private static instance: NotificationValidator|null = null;
  private notificationsGet: Schema;
  private notificationsEndUserReportError: Schema;

  private constructor() {
    super('NotificationValidator');
    this.notificationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-get.json`, 'utf8'));
    this.notificationsEndUserReportError = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-end-user-report-error.json`, 'utf8'));
  }

  public static getInstance(): NotificationValidator {
    if (!NotificationValidator.instance) {
      NotificationValidator.instance = new NotificationValidator();
    }
    return NotificationValidator.instance;
  }

  public validateGetNotificationsReq(data: any): HttpNotificationRequest {
    // Validate schema
    this.validate(this.notificationsGet, data);
    return data;
  }

  public validateEndUserReportErrorReq(data: any): HttpEndUserReportErrorRequest {
    // Validate schema
    this.validate(this.notificationsEndUserReportError, data);
    return data;
  }
}
