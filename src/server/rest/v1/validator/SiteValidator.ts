import { HttpSiteAssignUsersRequest, HttpSiteImageRequest, HttpSiteOwnerRequest, HttpSiteRequest, HttpSiteUserAdminRequest, HttpSiteUsersRequest, HttpSitesRequest } from '../../../../types/requests/HttpSiteRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import Site from '../../../../types/Site';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteValidator extends SchemaValidator {
  private static instance: SiteValidator|null = null;
  private siteCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-create.json`, 'utf8'));
  private siteAdmin: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-admin.json`, 'utf8'));
  private siteOwner: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-owner.json`, 'utf8'));
  private sitesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/sites-get.json`, 'utf8'));
  private siteAssignUsers: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-users-assign.json`, 'utf8'));
  private siteGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get.json`, 'utf8'));
  private siteGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get-image.json`, 'utf8'));
  private siteGetUsers: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-get-users.json`, 'utf8'));
  private siteUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-update.json`, 'utf8'));

  private constructor() {
    super('SiteValidator');
  }

  public static getInstance(): SiteValidator {
    if (!SiteValidator.instance) {
      SiteValidator.instance = new SiteValidator();
    }
    return SiteValidator.instance;
  }

  public validateSiteCreateReq(data: Record<string, unknown>): Site {
    return this.validate(this.siteCreate, data);
  }

  public validateSiteAdminReq(data: Record<string, unknown>): HttpSiteUserAdminRequest {
    return this.validate(this.siteAdmin, data);
  }

  public validateSiteOwnerReq(data: Record<string, unknown>): HttpSiteOwnerRequest {
    return this.validate(this.siteOwner, data);
  }

  public validateSitesGetReq(data: Record<string, unknown>): HttpSitesRequest {
    return this.validate(this.sitesGet, data);
  }

  public validateSiteAssignUsersReq(data: Record<string, unknown>): HttpSiteAssignUsersRequest {
    return this.validate(this.siteAssignUsers, data);
  }

  public validateSiteGetReq(data: Record<string, unknown>): HttpSiteRequest {
    return this.validate(this.siteGet, data);
  }

  public validateSiteGetImageReq(data: Record<string, unknown>): HttpSiteImageRequest {
    return this.validate(this.siteGetImage, data);
  }

  public validateSiteGetUsersReq(data: Record<string, unknown>): HttpSiteUsersRequest {
    return this.validate(this.siteGetUsers, data);
  }

  public validateSiteUpdateReq(data: Record<string, unknown>): Site {
    return this.validate(this.siteUpdate, data);
  }
}
