import { Configuration } from '../../types/configuration/Configuration';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class ConfigurationValidatorStorage extends SchemaValidator {
  private static instance: ConfigurationValidatorStorage | null = null;
  private configuration: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/configuration/configuration.json`, 'utf8'));

  private constructor() {
    super('ConfigurationValidatorStorage', {
      strict: true,
      allErrors: true,
      removeAdditional: 'all',
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
  }

  public static getInstance(): ConfigurationValidatorStorage {
    if (!ConfigurationValidatorStorage.instance) {
      ConfigurationValidatorStorage.instance = new ConfigurationValidatorStorage();
    }
    return ConfigurationValidatorStorage.instance;
  }

  public validateConfiguration(data: any): Configuration {
    return this.validate(this.configuration, data);
  }
}
