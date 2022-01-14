import HttpStatisticsRequest from '../../../../types/requests/HttpStatisticRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class StatisticsValidator extends SchemaValidator {
  private static instance: StatisticsValidator|null = null;
  private statisticsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/statistic/statistics-get.json`, 'utf8'));
  private statisticsExport: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/statistic/statistics-export.json`, 'utf8'));

  private constructor() {
    super('StatisticsValidator');
  }

  public static getInstance(): StatisticsValidator {
    if (!StatisticsValidator.instance) {
      StatisticsValidator.instance = new StatisticsValidator();
    }
    return StatisticsValidator.instance;
  }

  public validateStatisticsGet(data: Record<string, unknown>): HttpStatisticsRequest {
    return this.validate(this.statisticsGet, data);
  }

  public validateStatisticsExport(data: Record<string, unknown>): HttpStatisticsRequest {
    return this.validate(this.statisticsExport, data);
  }
}
