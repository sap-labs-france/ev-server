import PerformanceRecord from '../../../types/Performance';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class PerformanceValidatorStorage extends SchemaValidator {
  private static instance: PerformanceValidatorStorage | null = null;
  private performance: Schema;

  private constructor() {
    super('PerformanceValidatorStorage', {
      strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: false, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
    this.performance = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/performance/performance.json`, 'utf8'));
  }

  public static getInstance(): PerformanceValidatorStorage {
    if (!PerformanceValidatorStorage.instance) {
      PerformanceValidatorStorage.instance = new PerformanceValidatorStorage();
    }
    return PerformanceValidatorStorage.instance;
  }

  public validatePerformance(data: Record<string, unknown>): PerformanceRecord {
    return this.validate(this.performance, data);
  }
}
