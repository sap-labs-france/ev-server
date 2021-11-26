import { HttpSiteAreaImageRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteAreaValidator extends SchemaValidator {
  private static instance: SiteAreaValidator | undefined;
  private siteAreasGet: Schema;
  private siteAreaGet: Schema;
  private siteAreaGetImage: Schema;


  private constructor() {
    super('SiteAreaValidator');
    this.siteAreasGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-areas-get.json`, 'utf8'));
    this.siteAreaGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get.json`, 'utf8'));
    this.siteAreaGetImage = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-image.json`, 'utf8'));
  }

  public static getInstance(): SiteAreaValidator {
    if (!SiteAreaValidator.instance) {
      SiteAreaValidator.instance = new SiteAreaValidator();
    }
    return SiteAreaValidator.instance;
  }

  public validateSiteAreasGetReq(data: Record<string, unknown>): HttpSiteAreasRequest {
    return this.validate(this.siteAreasGet, data);
  }

  public validateSiteAreaGetReq(data: Record<string, unknown>): HttpSiteAreaRequest {
    return this.validate(this.siteAreaGet, data);
  }

  public validateSiteAreaGetImageReq(data: Record<string, unknown>): HttpSiteAreaImageRequest {
    return this.validate(this.siteAreaGetImage, data);
  }
}
