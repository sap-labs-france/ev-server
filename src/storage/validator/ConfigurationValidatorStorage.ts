import { Configuration } from '../../types/configuration/Configuration';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class ConfigurationValidatorStorage extends SchemaValidator {
  private static instance: ConfigurationValidatorStorage | null = null;
  private configurationSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/configuration/configuration-save.json`, 'utf8'));

  private constructor() {
    super('ConfigurationValidatorStorage');
  }

  public static getInstance(): ConfigurationValidatorStorage {
    if (!ConfigurationValidatorStorage.instance) {
      ConfigurationValidatorStorage.instance = new ConfigurationValidatorStorage();
    }
    return ConfigurationValidatorStorage.instance;
  }

  public validateConfigurationSave(data: any): Configuration {
    return this.validate(this.configurationSave, data, true);
  }
}
