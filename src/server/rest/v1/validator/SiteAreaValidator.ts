import { HttpAssignAssetsToSiteAreaRequest, HttpAssignChargingStationToSiteAreaRequest, HttpSiteAreaConsumptionsRequest, HttpSiteAreaImageRequest, HttpSiteAreaRequest, HttpSiteAreaUpdateRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import SiteArea from '../../../../types/SiteArea';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteAreaValidator extends SchemaValidator {
  private static instance: SiteAreaValidator | undefined;
  private siteAreasGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-areas-get.json`, 'utf8'));
  private siteAreaGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get.json`, 'utf8'));
  private siteAreaGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-image.json`, 'utf8'));
  private siteAreaCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-create.json`, 'utf8'));
  private siteAreaUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-update.json`, 'utf8'));
  private siteAreaAssignChargingStations: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-charging-stations.json`, 'utf8'));
  private siteAreaAssignAssets: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-assets.json`, 'utf8'));
  private siteAreaGetConsumption: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-consumption.json`, 'utf8'));


  private constructor() {
    super('SiteAreaValidator');
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

  public validateSiteAreaCreateReq(data: Record<string, unknown>): SiteArea {
    return this.validate(this.siteAreaCreate, data);
  }

  public validateSiteAreaUpdateReq(data: Record<string, unknown>): HttpSiteAreaUpdateRequest {
    return this.validate(this.siteAreaUpdate, data);
  }

  public validateSiteAreaAssignChargingStationsReq(data: Record<string, unknown>): HttpAssignChargingStationToSiteAreaRequest {
    return this.validate(this.siteAreaAssignChargingStations, data);
  }

  public validateSiteAreaAssignAssetsReq(data: Record<string, unknown>): HttpAssignAssetsToSiteAreaRequest {
    return this.validate(this.siteAreaAssignAssets, data);
  }

  public validateSiteAreaGetConsumptionReq(data: Record<string, unknown>): HttpSiteAreaConsumptionsRequest {
    return this.validate(this.siteAreaGetConsumption, data);
  }
}
