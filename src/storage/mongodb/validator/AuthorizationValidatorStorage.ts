import { AuthorizationDefinitionRole } from '../../../types/Authorization';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class AuthorizationValidatorStorage extends SchemaValidator {
  private static instance: AuthorizationValidatorStorage | null = null;
  private authorizationRole: Schema;

  private constructor() {
    super('AuthorizationValidatorStorage', {
      strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: true, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
    this.authorizationRole = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/authorization/authorization-role.json`, 'utf8'));
  }

  public static getInstance(): AuthorizationValidatorStorage {
    if (!AuthorizationValidatorStorage.instance) {
      AuthorizationValidatorStorage.instance = new AuthorizationValidatorStorage();
    }
    return AuthorizationValidatorStorage.instance;
  }

  public validateAuthorizationDefinitionRole(data: Record<string, unknown>): AuthorizationDefinitionRole {
    return this.validate(this.authorizationRole, data);
  }
}
