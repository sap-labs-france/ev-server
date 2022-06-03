import { HttpEndUserReportErrorGetRequest, HttpNotificationGetRequest } from '../../../../types/requests/HttpNotificationRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class NotificationValidatorRest extends SchemaValidator {
  private static instance: NotificationValidatorRest|null = null;
  private notificationsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-get.json`, 'utf8'));
  private notificationsEndUserErrorReport: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/notification/notifications-end-user-error-report.json`, 'utf8'));

  private constructor() {
    super('NotificationValidatorRest');
  }

  public static getInstance(): NotificationValidatorRest {
    if (!NotificationValidatorRest.instance) {
      NotificationValidatorRest.instance = new NotificationValidatorRest();
    }
    return NotificationValidatorRest.instance;
  }

  public validateNotificationsGetReq(data: Record<string, unknown>): HttpNotificationGetRequest {
    return this.validate(this.notificationsGet, data);
  }

  public validateEndUserErrorReportReq(data: Record<string, unknown>): HttpEndUserReportErrorGetRequest {
    return this.validate(this.notificationsEndUserErrorReport, data);
  }
}
