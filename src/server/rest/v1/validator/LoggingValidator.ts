import { HttpLogRequest, HttpLogsRequest } from '../../../../types/requests/HttpLoggingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class LoggingValidator extends SchemaValidator {
  private static instance: LoggingValidator|null = null;
  private loggingsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/logging/loggings-get.json`, 'utf8'));
  private loggingGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/logging/logging-get.json`, 'utf8'));

  private constructor() {
    super('LoggingValidator');
  }

  public static getInstance(): LoggingValidator {
    if (!LoggingValidator.instance) {
      LoggingValidator.instance = new LoggingValidator();
    }
    return LoggingValidator.instance;
  }

  public validateLoggingsGetReq(data: Record<string, unknown>): HttpLogsRequest {
    return this.validate(this.loggingsGet, data);
  }

  public validateLoggingGetReq(data: Record<string, unknown>): HttpLogRequest {
    return this.validate(this.loggingGet, data);
  }
}
