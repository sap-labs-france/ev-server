import User, { ImportedUser } from '../../../../types/User';

import { HttpUserSitesRequest } from '../../../../types/requests/HttpUserRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator|null = null;
  private importedUserCreation: Schema;
  private userCreate: Schema;
  private userGetSites: Schema;

  private constructor() {
    super('UserValidator');
    this.importedUserCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/imported-user-create-req.json`, 'utf8'));
    this.userCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
    this.userGetSites = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get-sites.json`, 'utf8'));
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

  validateUserCreate(user: any): Partial<User> {
    this.validate(this.userCreate, user);
    user.password = user.passwords.password;
    return user;
  }

  validateUserGetSites(data: any): HttpUserSitesRequest {
    this.validate(this.userGetSites, data);
    return data;
  }
}
