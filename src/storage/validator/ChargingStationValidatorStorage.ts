import { ChargingStationTemplate } from '../../types/ChargingStation';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class ChargingStationValidatorStorage extends SchemaValidator {
  private static instance: ChargingStationValidatorStorage | null = null;
  private chargingStationTemplate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation-template.json`, 'utf8'));

  private constructor() {
    super('ChargingStationValidatorStorage');
  }

  public static getInstance(): ChargingStationValidatorStorage {
    if (!ChargingStationValidatorStorage.instance) {
      ChargingStationValidatorStorage.instance = new ChargingStationValidatorStorage();
    }
    return ChargingStationValidatorStorage.instance;
  }

  public validateChargingStationTemplate(data: any): ChargingStationTemplate {
    return this.validate(this.chargingStationTemplate, data, true);
  }
}
