import { HttpSiteAdminUpdateRequest, HttpSiteAssignUsersRequest, HttpSiteCreateRequest, HttpSiteDeleteRequest, HttpSiteGetRequest, HttpSiteImageGetRequest, HttpSiteOwnerUpdateRequest, HttpSiteUpdateRequest, HttpSiteUsersRequest, HttpSitesGetRequest } from '../../../../types/requests/HttpSiteRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteValidatorRest extends SchemaValidator {
  private static instance: SiteValidatorRest|null = null;
  private siteCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-create.json`, 'utf8'));
  private siteAdminUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-admin-update.json`, 'utf8'));
  private siteOwnerUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-owner-update.json`, 'utf8'));
  private sitesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/sites-get.json`, 'utf8'));
  private siteAssignUsers: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-users-assign.json`, 'utf8'));
  private siteGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get.json`, 'utf8'));
  private siteDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-delete.json`, 'utf8'));
  private siteGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get-image.json`, 'utf8'));
  private siteGetUsers: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get-users.json`, 'utf8'));
  private siteUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-update.json`, 'utf8'));

  private constructor() {
    super('SiteValidatorRest');
  }

  public static getInstance(): SiteValidatorRest {
    if (!SiteValidatorRest.instance) {
      SiteValidatorRest.instance = new SiteValidatorRest();
    }
    return SiteValidatorRest.instance;
  }

  public validateSiteCreateReq(data: Record<string, unknown>): HttpSiteCreateRequest {
    return this.validate(this.siteCreate, data);
  }

  public validateSiteAdminUpdateReq(data: Record<string, unknown>): HttpSiteAdminUpdateRequest {
    return this.validate(this.siteAdminUpdate, data);
  }

  public validateSiteOwnerUpdateReq(data: Record<string, unknown>): HttpSiteOwnerUpdateRequest {
    return this.validate(this.siteOwnerUpdate, data);
  }

  public validateSitesGetReq(data: Record<string, unknown>): HttpSitesGetRequest {
    return this.validate(this.sitesGet, data);
  }

  public validateSiteAssignUsersReq(data: Record<string, unknown>): HttpSiteAssignUsersRequest {
    return this.validate(this.siteAssignUsers, data);
  }

  public validateSiteGetReq(data: Record<string, unknown>): HttpSiteGetRequest {
    return this.validate(this.siteGet, data);
  }

  public validateSiteDeleteReq(data: Record<string, unknown>): HttpSiteDeleteRequest {
    return this.validate(this.siteDelete, data);
  }

  public validateSiteGetImageReq(data: Record<string, unknown>): HttpSiteImageGetRequest {
    return this.validate(this.siteGetImage, data);
  }

  public validateSiteGetUsersReq(data: Record<string, unknown>): HttpSiteUsersRequest {
    return this.validate(this.siteGetUsers, data);
  }

  public validateSiteUpdateReq(data: Record<string, unknown>): HttpSiteUpdateRequest {
    return this.validate(this.siteUpdate, data);
  }
}
