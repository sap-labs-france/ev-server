import { ChargingStationTemplate } from '../../../types/ChargingStation';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class ChargingStationValidatorStorage extends SchemaValidator {
  private static instance: ChargingStationValidatorStorage | null = null;
  private chargingStationTemplate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation-template.json`, 'utf8'));

  private constructor() {
    super('ChargingStationValidatorStorage', {
      strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: true, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
  }

  public static getInstance(): ChargingStationValidatorStorage {
    if (!ChargingStationValidatorStorage.instance) {
      ChargingStationValidatorStorage.instance = new ChargingStationValidatorStorage();
    }
    return ChargingStationValidatorStorage.instance;
  }

  public validateChargingStationTemplate(data: any): ChargingStationTemplate {
    return this.validate(this.chargingStationTemplate, data);
  }
}
