import { HttpSiteOwnerRequest, HttpSiteUserAdminRequest, HttpSitesRequest } from '../../../../types/requests/HttpSiteRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import Site from '../../../../types/Site';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteValidator extends SchemaValidator {
  private static instance: SiteValidator|null = null;
  private siteCreate: Schema;
  private siteAdmin: Schema;
  private siteOwner: Schema;
  private sitesGet: Schema;

  private constructor() {
    super('SiteValidator');
    this.siteCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-create.json`, 'utf8'));
    this.siteAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-admin.json`, 'utf8'));
    this.siteOwner = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/site-owner.json`, 'utf8'));
    this.sitesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site/sites-get.json`, 'utf8'));
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
}
