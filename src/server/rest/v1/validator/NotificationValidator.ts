import { HttpEndUserReportErrorRequest, HttpNotificationRequest } from '../../../../types/requests/HttpNotificationRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class NotificationValidator extends SchemaValidator {
  private static instance: NotificationValidator|null = null;
  private notificationsGet: Schema;
  private notificationsEndUserErrorReport: Schema;

  private constructor() {
    super('NotificationValidator');
    this.notificationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-get.json`, 'utf8'));
    this.notificationsEndUserErrorReport = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-end-user-error-report.json`, 'utf8'));
  }

  public static getInstance(): NotificationValidator {
    if (!NotificationValidator.instance) {
      NotificationValidator.instance = new NotificationValidator();
    }
    return NotificationValidator.instance;
  }

  public validateNotificationsGetReq(data: unknown): HttpNotificationRequest {
    return this.validate('validateNotificationsGetReq', this.notificationsGet, data);
  }

  public validateEndUserErrorReportReq(data: unknown): HttpEndUserReportErrorRequest {
    return this.validate('validateEndUserErrorReportReq', this.notificationsEndUserErrorReport, data);
  }
}
