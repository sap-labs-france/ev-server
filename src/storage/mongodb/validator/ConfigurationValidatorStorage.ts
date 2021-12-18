import { Configuration } from '../../../types/configuration/Configuration';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class ConfigurationValidatorStorage extends SchemaValidator {
  private static instance: ConfigurationValidatorStorage | null = null;
  private configuration: Schema;

  private constructor() {
    super('ConfigurationValidatorStorage', {
      strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: false, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
    this.configuration = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/configuration/configuration.json`, 'utf8'));
  }

  public static getInstance(): ConfigurationValidatorStorage {
    if (!ConfigurationValidatorStorage.instance) {
      ConfigurationValidatorStorage.instance = new ConfigurationValidatorStorage();
    }
    return ConfigurationValidatorStorage.instance;
  }

  public validateConfiguration(data: Record<string, unknown>): Configuration {
    return this.validate(this.configuration, data);
  }
}
