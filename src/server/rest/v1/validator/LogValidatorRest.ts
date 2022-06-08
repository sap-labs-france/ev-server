import { HttpLogGetRequest, HttpLogsGetRequest } from '../../../../types/requests/HttpLogRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class LogValidatorRest extends SchemaValidator {
  private static instance: LogValidatorRest|null = null;
  private logsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/log/logs-get.json`, 'utf8'));
  private logGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/log/log-get.json`, 'utf8'));

  private constructor() {
    super('LogValidatorRest');
  }

  public static getInstance(): LogValidatorRest {
    if (!LogValidatorRest.instance) {
      LogValidatorRest.instance = new LogValidatorRest();
    }
    return LogValidatorRest.instance;
  }

  public validateLogsGetReq(data: Record<string, unknown>): HttpLogsGetRequest {
    return this.validate(this.logsGet, data);
  }

  public validateLogGetReq(data: Record<string, unknown>): HttpLogGetRequest {
    return this.validate(this.logGet, data);
  }
}
