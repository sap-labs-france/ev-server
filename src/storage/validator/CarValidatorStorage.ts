import { ChargingStationTemplate } from '../../types/ChargingStation';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class CarValidatorStorage extends SchemaValidator {
  private static instance: CarValidatorStorage | null = null;
  private carCatalogSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/car/car-catalog-save.json`, 'utf8'));

  private constructor() {
    super('CarValidatorStorage');
  }

  public static getInstance(): CarValidatorStorage {
    if (!CarValidatorStorage.instance) {
      CarValidatorStorage.instance = new CarValidatorStorage();
    }
    return CarValidatorStorage.instance;
  }

  public validateCarCatalogSave(data: any): ChargingStationTemplate {
    return this.validate(this.carCatalogSave, data, true);
  }
}
