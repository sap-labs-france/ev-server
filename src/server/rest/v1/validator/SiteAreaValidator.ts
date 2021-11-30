import { HttpAssignAssetsToSiteAreaRequest, HttpAssignChargingStationToSiteAreaRequest, HttpSiteAreaConsumptionsRequest, HttpSiteAreaImageRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import SiteArea from '../../../../types/SiteArea';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteAreaValidator extends SchemaValidator {
  private static instance: SiteAreaValidator | undefined;
  private siteAreasGet: Schema;
  private siteAreaGet: Schema;
  private siteAreaGetImage: Schema;
  private siteAreaCreate: Schema;
  private siteAreaUpdate: Schema;
  private siteAreaAssignChargingStations: Schema;
  private siteAreaAssignAssets: Schema;
  private siteAreaGetConsumption: Schema;


  private constructor() {
    super('SiteAreaValidator');
    this.siteAreasGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-areas-get.json`, 'utf8'));
    this.siteAreaGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get.json`, 'utf8'));
    this.siteAreaGetImage = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-image.json`, 'utf8'));
    this.siteAreaCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-create.json`, 'utf8'));
    this.siteAreaUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-update.json`, 'utf8'));
    this.siteAreaAssignChargingStations = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-charging-stations.json`, 'utf8'));
    this.siteAreaAssignAssets = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-assets.json`, 'utf8'));
    this.siteAreaGetConsumption = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-consumption.json`, 'utf8'));
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

  public validateSiteAreaUpdateReq(data: Record<string, unknown>): SiteArea {
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
