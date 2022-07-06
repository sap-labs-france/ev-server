import { AuthorizationDefinitionRole } from '../../types/Authorization';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class AuthorizationValidatorStorage extends SchemaValidator {
  private static instance: AuthorizationValidatorStorage | null = null;
  private authorizationRoleSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/authorization/authorization-role-save.json`, 'utf8'));

  private constructor() {
    super('AuthorizationValidatorStorage');
  }

  public static getInstance(): AuthorizationValidatorStorage {
    if (!AuthorizationValidatorStorage.instance) {
      AuthorizationValidatorStorage.instance = new AuthorizationValidatorStorage();
    }
    return AuthorizationValidatorStorage.instance;
  }

  public validateAuthorizationDefinitionRoleSave(data: any): AuthorizationDefinitionRole {
    return this.validate(this.authorizationRoleSave, data, true);
  }
}
