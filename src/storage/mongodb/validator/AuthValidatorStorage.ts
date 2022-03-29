import { ChargingStationTemplate } from '../../../types/ChargingStation';
import { HttpRegisterUserRequest } from '../../../types/requests/HttpUserRequest';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class AuthValidatorStorage extends SchemaValidator {
  private static instance: AuthValidatorStorage | null = null;
  private authSignOn: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));

  private constructor() {
    super('AuthValidatorStorage', {
      strict: true, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: true, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
  }

  public static getInstance(): AuthValidatorStorage {
    if (!AuthValidatorStorage.instance) {
      AuthValidatorStorage.instance = new AuthValidatorStorage();
    }
    return AuthValidatorStorage.instance;
  }

  public validateAuthSignOn(data: any): Partial<HttpRegisterUserRequest> {
    return this.validate(this.authSignOn, data);
  }
}
