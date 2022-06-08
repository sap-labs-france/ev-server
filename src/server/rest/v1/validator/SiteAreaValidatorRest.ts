import { HttpAssignAssetsToSiteAreaRequest, HttpAssignChargingStationToSiteAreaRequest, HttpSiteAreaConsumptionsGetRequest, HttpSiteAreaCreateRequest, HttpSiteAreaDeleteRequest, HttpSiteAreaGetRequest, HttpSiteAreaImageGetRequest, HttpSiteAreaUpdateRequest, HttpSiteAreasGetRequest } from '../../../../types/requests/HttpSiteAreaRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SiteAreaValidatorRest extends SchemaValidator {
  private static instance: SiteAreaValidatorRest | undefined;
  private siteAreasGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-areas-get.json`, 'utf8'));
  private siteAreaGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get.json`, 'utf8'));
  private siteAreaGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-image.json`, 'utf8'));
  private siteAreaCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-create.json`, 'utf8'));
  private siteAreaUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-update.json`, 'utf8'));
  private siteAreaDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-delete.json`, 'utf8'));
  private siteAreaAssignChargingStations: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-charging-stations.json`, 'utf8'));
  private siteAreaAssignAssets: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-assign-assets.json`, 'utf8'));
  private siteAreaGetConsumption: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/site-area/site-area-get-consumption.json`, 'utf8'));


  private constructor() {
    super('SiteAreaValidatorRest');
  }

  public static getInstance(): SiteAreaValidatorRest {
    if (!SiteAreaValidatorRest.instance) {
      SiteAreaValidatorRest.instance = new SiteAreaValidatorRest();
    }
    return SiteAreaValidatorRest.instance;
  }

  public validateSiteAreasGetReq(data: Record<string, unknown>): HttpSiteAreasGetRequest {
    return this.validate(this.siteAreasGet, data);
  }

  public validateSiteAreaGetReq(data: Record<string, unknown>): HttpSiteAreaGetRequest {
    return this.validate(this.siteAreaGet, data);
  }

  public validateSiteAreaDeleteReq(data: Record<string, unknown>): HttpSiteAreaDeleteRequest {
    return this.validate(this.siteAreaDelete, data);
  }

  public validateSiteAreaGetImageReq(data: Record<string, unknown>): HttpSiteAreaImageGetRequest {
    return this.validate(this.siteAreaGetImage, data);
  }

  public validateSiteAreaCreateReq(data: Record<string, unknown>): HttpSiteAreaCreateRequest {
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

  public validateSiteAreaGetConsumptionReq(data: Record<string, unknown>): HttpSiteAreaConsumptionsGetRequest {
    return this.validate(this.siteAreaGetConsumption, data);
  }
}
