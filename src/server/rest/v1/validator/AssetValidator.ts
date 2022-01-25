import { HttpAssetCheckConnection, HttpAssetConsumptionRequest, HttpAssetImageRequest, HttpAssetRequest, HttpAssetsRequest } from '../../../../types/requests/HttpAssetRequest';

import Asset from '../../../../types/Asset';
import Consumption from '../../../../types/Consumption';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AssetValidator extends SchemaValidator {
  private static instance: AssetValidator|null = null;
  private assetConsumptionCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-consumption-create.json`, 'utf8'));
  private assetGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get.json`, 'utf8'));
  private assetsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/assets-get.json`, 'utf8'));
  private assetCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-create.json`, 'utf8'));
  private assetUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-update.json`, 'utf8'));
  private assetConsumptionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-consumptions-get.json`, 'utf8'));
  private assetConnectionCheck: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-connection-check.json`, 'utf8'));
  private assetGetImage: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get-image.json`, 'utf8'));

  private constructor() {
    super('AssetValidator');
  }

  public static getInstance(): AssetValidator {
    if (!AssetValidator.instance) {
      AssetValidator.instance = new AssetValidator();
    }
    return AssetValidator.instance;
  }

  public validateAssetConsumptionCreateReq(data: Record<string, unknown>): Consumption {
    return this.validate(this.assetConsumptionCreate, data);
  }

  public validateAssetGetReq(data: Record<string, unknown>): HttpAssetRequest {
    return this.validate(this.assetGet, data);
  }

  public validateAssetsGetReq(data: Record<string, unknown>): HttpAssetsRequest {
    return this.validate(this.assetsGet, data);
  }

  public validateAssetCreateReq(data: Record<string, unknown>): Asset {
    return this.validate(this.assetCreate, data);
  }

  public validateAssetUpdateReq(data: Record<string, unknown>): Asset {
    return this.validate(this.assetUpdate, data);
  }

  public validateAssetGetConsumptionsReq(data: Record<string, unknown>): HttpAssetConsumptionRequest {
    return this.validate(this.assetConsumptionsGet, data);
  }

  public validateAssetCheckConnectionReq(data: Record<string, unknown>): HttpAssetCheckConnection {
    return this.validate(this.assetConnectionCheck, data);
  }

  public validateAssetGetImageReq(data: Record<string, unknown>): HttpAssetImageRequest {
    return this.validate(this.assetGetImage, data);
  }
}
