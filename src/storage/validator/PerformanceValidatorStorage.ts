import PerformanceRecord from '../../types/Performance';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class PerformanceValidatorStorage extends SchemaValidator {
  private static instance: PerformanceValidatorStorage | null = null;
  private performanceSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/performance/performance-save.json`, 'utf8'));

  private constructor() {
    super('PerformanceValidatorStorage');
  }

  public static getInstance(): PerformanceValidatorStorage {
    if (!PerformanceValidatorStorage.instance) {
      PerformanceValidatorStorage.instance = new PerformanceValidatorStorage();
    }
    return PerformanceValidatorStorage.instance;
  }

  public validatePerformance(data: any): PerformanceRecord {
    return this.validate(this.performanceSave, data, true);
  }
}
