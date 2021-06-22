import User, { ImportedUser } from '../../../../types/User';

import Authorizations from '../../../../authorization/Authorizations';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator|null = null;
  private importedUserCreation: Schema;
  private userCreate: Schema;
  private userAdminCreate: Schema;

  private constructor() {
    super('UserValidator');
    this.importedUserCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/imported-user-create-req.json`, 'utf8'));
    this.userCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
    this.userAdminCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-admin-create.json`, 'utf8'));
  }

  public static getInstance(): UserValidator {
    if (!UserValidator.instance) {
      UserValidator.instance = new UserValidator();
    }
    return UserValidator.instance;
  }

  validateImportedUserCreation(importedUser: ImportedUser): void {
    this.validate(this.importedUserCreation, importedUser);
  }

  validateUserCreate(user: any, loggedUser: UserToken): Partial<User> {
    this.validate(this.userCreate, user);
    user.password = user.passwords.password;
    return user;
  }
}
