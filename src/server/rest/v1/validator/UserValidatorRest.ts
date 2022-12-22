import { HttpUserCreateRequest, HttpUserDefaultTagCarGetRequest, HttpUserDeleteRequest, HttpUserGetRequest, HttpUserMobileTokenUpdateRequest, HttpUserSessionContextGetRequest, HttpUserSitesAssignRequest, HttpUserSitesGetRequest, HttpUserUpdateRequest, HttpUsersGetRequest, HttpUsersInErrorGetRequest } from '../../../../types/requests/HttpUserRequest';

import { ImportedUser } from '../../../../types/User';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidatorRest extends SchemaValidator {
  private static instance: UserValidatorRest | null = null;
  private userImportCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-import-create.json`, 'utf8'));
  private userCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
  private userSitesAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-assign.json`, 'utf8'));
  private userGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get.json`, 'utf8'));
  private userDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-delete.json`, 'utf8'));
  private usersGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-get.json`, 'utf8'));
  private usersInErrorGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-inerror-get.json`, 'utf8'));
  private userSitesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-sites-get.json`, 'utf8'));
  private userUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-update.json`, 'utf8'));
  private userMobileDataUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-mobile-data-update.json`, 'utf8'));
  private userDefaultTagCarGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-default-tag-car-get.json`, 'utf8'));
  private userSessionContextGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-session-context-get.json`, 'utf8'));

  private constructor() {
    super('UserValidatorRest');
  }

  public static getInstance(): UserValidatorRest {
    if (!UserValidatorRest.instance) {
      UserValidatorRest.instance = new UserValidatorRest();
    }
    return UserValidatorRest.instance;
  }

  public validateUserImportCreateReq(data: ImportedUser): void {
    this.validate(this.userImportCreate, data);
  }

  public validateUserCreateReq(data: Record<string, unknown>): HttpUserCreateRequest {
    return this.validate(this.userCreate, data);
  }

  public validateUserSitesAssignReq(data: Record<string, unknown>): HttpUserSitesAssignRequest {
    return this.validate(this.userSitesAssign, data);
  }

  public validateUserGetReq(data: Record<string, unknown>): HttpUserGetRequest {
    return this.validate(this.userGet, data);
  }

  public validateUserDeleteReq(data: Record<string, unknown>): HttpUserDeleteRequest {
    return this.validate(this.userDelete, data);
  }

  public validateUsersGetReq(data: Record<string, unknown>): HttpUsersGetRequest {
    return this.validate(this.usersGet, data);
  }

  public validateUsersInErrorGetReq(data: Record<string, unknown>): HttpUsersInErrorGetRequest {
    return this.validate(this.usersInErrorGet, data);
  }

  public validateUserSitesGetReq(data: Record<string, unknown>): HttpUserSitesGetRequest {
    return this.validate(this.userSitesGet, data);
  }

  public validateUserUpdateReq(data: Record<string, unknown>): HttpUserUpdateRequest {
    return this.validate(this.userUpdate, data);
  }

  public validateUserMobileDataUpdateReq(data: Record<string, unknown>): HttpUserMobileTokenUpdateRequest {
    return this.validate(this.userMobileDataUpdate, data);
  }

  public validateUserDefaultTagCarGetReq(data: Record<string, unknown>): HttpUserDefaultTagCarGetRequest {
    return this.validate(this.userDefaultTagCarGet, data);
  }

  public validateUserSessionContextReq(data: Record<string, unknown>): HttpUserSessionContextGetRequest {
    return this.validate(this.userSessionContextGet, data);
  }
}
