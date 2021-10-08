import { AuthorizationDefinitionRole } from '../../../types/Authorization';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class AuthorizationValidatorStorage extends SchemaValidator {
  private static instance: AuthorizationValidatorStorage | null = null;
  private authorizationRole: Schema;

  private constructor() {
    super('AuthorizationValidatorStorage');
    this.authorizationRole = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/authorization/authorization-role.json`, 'utf8'));
  }

  public static getInstance(): AuthorizationValidatorStorage {
    if (!AuthorizationValidatorStorage.instance) {
      AuthorizationValidatorStorage.instance = new AuthorizationValidatorStorage();
    }
    return AuthorizationValidatorStorage.instance;
  }

  public validateAuthorizationDefinitionRole(data: unknown): AuthorizationDefinitionRole {
    return this.validate('validateAuthorizationDefinitionRole', this.authorizationRole, data);
  }
}
