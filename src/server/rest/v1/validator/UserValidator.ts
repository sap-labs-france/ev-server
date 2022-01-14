import { HttpUserAssignSitesRequest, HttpUserDefaultTagCar, HttpUserMobileTokenRequest, HttpUserSitesRequest, HttpUsersInErrorRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User, { ImportedUser } from '../../../../types/User';

import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator | null = null;
  private userImportCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-import-create.json`, 'utf8'));
  private userCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
  private userSitesAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-assign.json`, 'utf8'));
  private userByIDGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get.json`, 'utf8'));
  private usersGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-get.json`, 'utf8'));
  private usersInErrorGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-inerror-get.json`, 'utf8'));
  private userSitesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-get.json`, 'utf8'));
  private userUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-update.json`, 'utf8'));
  private userMobileTokenUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-mobile-token-update.json`, 'utf8'));
  private userDefaultTagCarGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-default-tag-car-get.json`, 'utf8'));

  private constructor() {
    super('UserValidator');
  }

  public static getInstance(): UserValidator {
    if (!UserValidator.instance) {
      UserValidator.instance = new UserValidator();
    }
    return UserValidator.instance;
  }

  public validateUserImportCreateReq(data: ImportedUser): void {
    this.validate(this.userImportCreate, data);
  }

  public validateUserCreateReq(data: Record<string, unknown>): User {
    return this.validate(this.userCreate, data);
  }

  public validateUserToSitesAssignReq(data: Record<string, unknown>): HttpUserAssignSitesRequest {
    return this.validate(this.userSitesAssign, data);
  }

  public validateUserByIDGetReq(data: Record<string, unknown>): HttpByIDRequest {
    return this.validate(this.userByIDGet, data);
  }

  public validateUsersGetReq(data: Record<string, unknown>): HttpUsersRequest {
    return this.validate(this.usersGet, data);
  }

  public validateUsersInErrorGetReq(data: Record<string, unknown>): HttpUsersInErrorRequest {
    return this.validate(this.usersInErrorGet, data);
  }

  public validateUserSitesGetReq(data: Record<string, unknown>): HttpUserSitesRequest {
    return this.validate(this.userSitesGet, data);
  }

  public validateUserUpdateReq(data: Record<string, unknown>): User {
    return this.validate(this.userUpdate, data);
  }

  public validateUserMobileTokenUpdateReq(data: Record<string, unknown>): HttpUserMobileTokenRequest {
    return this.validate(this.userMobileTokenUpdate, data);
  }

  public validateUserDefaultTagCarGetReq(data: Record<string, unknown>): HttpUserDefaultTagCar {
    return this.validate(this.userDefaultTagCarGet, data);
  }
}
