import { HttpUserAssignSitesRequest, HttpUserDefaultTagCar, HttpUserMobileTokenRequest, HttpUserSitesRequest, HttpUsersInErrorRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';

import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import User from '../../../../types/User';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator | null = null;
  private userImportCreate: Schema;
  private userCreate: Schema;
  private userSitesAssign: Schema;
  private userByIDGet: Schema;
  private usersGet: Schema;
  private usersInErrorGet: Schema;
  private userSitesGet: Schema;
  private userUpdate: Schema;
  private userMobileTokenUpdate: Schema;
  private userDefaultTagCarGet: Schema;

  private constructor() {
    super('UserValidator');
    this.userImportCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-import-create.json`, 'utf8'));
    this.userCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
    this.userSitesAssign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-assign.json`, 'utf8'));
    this.userByIDGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get.json`, 'utf8'));
    this.usersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-get.json`, 'utf8'));
    this.usersInErrorGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-inerror-get.json`, 'utf8'));
    this.userSitesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-get.json`, 'utf8'));
    this.userUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-update.json`, 'utf8'));
    this.userMobileTokenUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-mobile-token-update.json`, 'utf8'));
    this.userDefaultTagCarGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-default-tag-car-get.json`, 'utf8'));
  }

  public static getInstance(): UserValidator {
    if (!UserValidator.instance) {
      UserValidator.instance = new UserValidator();
    }
    return UserValidator.instance;
  }

  public validateUserImportCreateReq(data: unknown): void {
    this.validate('validateUserImportCreateReq', this.userImportCreate, data);
  }

  public validateUserCreateReq(data: unknown): User {
    return this.validate('validateUserCreateReq', this.userCreate, data);
  }

  public validateUserToSitesAssignReq(data: unknown): HttpUserAssignSitesRequest {
    return this.validate('validateUserToSitesAssignReq', this.userSitesAssign, data);
  }

  public validateUserByIDGetReq(data: unknown): HttpByIDRequest {
    return this.validate('validateUserByIDGetReq', this.userByIDGet, data);
  }

  public validateUsersGetReq(data: unknown): HttpUsersRequest {
    return this.validate('validateUsersGetReq', this.usersGet, data);
  }

  public validateUsersInErrorGetReq(data: unknown): HttpUsersInErrorRequest {
    return this.validate('validateUsersInErrorGetReq', this.usersInErrorGet, data);
  }

  public validateUserSitesGetReq(data: unknown): HttpUserSitesRequest {
    return this.validate('validateUserSitesGetReq', this.userSitesGet, data);
  }

  public validateUserUpdateReq(data: unknown): User {
    return this.validate('validateUserUpdateReq', this.userUpdate, data);
  }

  public validateUserMobileTokenUpdateReq(data: unknown): HttpUserMobileTokenRequest {
    return this.validate('validateUserMobileTokenUpdateReq', this.userMobileTokenUpdate, data);
  }

  public validateUserDefaultTagCarGetReq(data: unknown): HttpUserDefaultTagCar {
    return this.validate('validateUserDefaultTagCarGetReq', this.userDefaultTagCarGet, data);
  }
}
