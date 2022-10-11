import { HttpAssetCheckConnection, HttpAssetConsumptionGetRequest, HttpAssetDeleteRequest, HttpAssetGetRequest, HttpAssetImageGetRequest, HttpAssetsGetRequest, HttpAssetsInErrorGetRequest } from '../../../../types/requests/HttpAssetRequest';

import Asset from '../../../../types/Asset';
import Consumption from '../../../../types/Consumption';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AssetValidatorRest extends SchemaValidator {
  private static instance: AssetValidatorRest|null = null;
  private assetConsumptionCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-consumption-create.json`, 'utf8'));
  private assetGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get.json`, 'utf8'));
  private assetsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/assets-get.json`, 'utf8'));
  private assetsInErrorGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/assets-inerror-get.json`, 'utf8'));
  private assetsDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-delete.json`, 'utf8'));
  private assetCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-create.json`, 'utf8'));
  private assetUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-update.json`, 'utf8'));
  private assetConsumptionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-consumptions-get.json`, 'utf8'));
  private assetConnectionCheck: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-connection-check.json`, 'utf8'));
  private assetGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get-image.json`, 'utf8'));

  private constructor() {
    super('AssetValidatorRest');
  }

  public static getInstance(): AssetValidatorRest {
    if (!AssetValidatorRest.instance) {
      AssetValidatorRest.instance = new AssetValidatorRest();
    }
    return AssetValidatorRest.instance;
  }

  public validateAssetConsumptionCreateReq(data: Record<string, unknown>): Consumption {
    return this.validate(this.assetConsumptionCreate, data);
  }

  public validateAssetGetReq(data: Record<string, unknown>): HttpAssetGetRequest {
    return this.validate(this.assetGet, data);
  }

  public validateAssetDeleteReq(data: Record<string, unknown>): HttpAssetDeleteRequest {
    return this.validate(this.assetsDelete, data);
  }

  public validateAssetsGetReq(data: Record<string, unknown>): HttpAssetsGetRequest {
    return this.validate(this.assetsGet, data);
  }

  public validateAssetsInErrorGetReq(data: Record<string, unknown>): HttpAssetsInErrorGetRequest {
    return this.validate(this.assetsInErrorGet, data);
  }

  public validateAssetCreateReq(data: Record<string, unknown>): Asset {
    return this.validate(this.assetCreate, data);
  }

  public validateAssetUpdateReq(data: Record<string, unknown>): Asset {
    return this.validate(this.assetUpdate, data);
  }

  public validateAssetGetConsumptionsReq(data: Record<string, unknown>): HttpAssetConsumptionGetRequest {
    return this.validate(this.assetConsumptionsGet, data);
  }

  public validateAssetCheckConnectionReq(data: Record<string, unknown>): HttpAssetCheckConnection {
    return this.validate(this.assetConnectionCheck, data);
  }

  public validateAssetGetImageReq(data: Record<string, unknown>): HttpAssetImageGetRequest {
    return this.validate(this.assetGetImage, data);
  }
}
