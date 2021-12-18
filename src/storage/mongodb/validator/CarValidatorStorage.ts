import { ChargingStationTemplate } from '../../../types/ChargingStation';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class CarValidatorStorage extends SchemaValidator {
  private static instance: CarValidatorStorage | null = null;
  private carCatalog: Schema;

  private constructor() {
    super('CarValidatorStorage', {
      strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: true, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
    this.carCatalog = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/car/car-catalog.json`, 'utf8'));
  }

  public static getInstance(): CarValidatorStorage {
    if (!CarValidatorStorage.instance) {
      CarValidatorStorage.instance = new CarValidatorStorage();
    }
    return CarValidatorStorage.instance;
  }

  public validateCarCatalog(data: any): ChargingStationTemplate {
    return this.validate(this.carCatalog, data);
  }
}
