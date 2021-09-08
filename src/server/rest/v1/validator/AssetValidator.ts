import { HttpAssetConsumptionRequest, HttpAssetRequest, HttpAssetsRequest } from '../../../../types/requests/HttpAssetRequest';

import Asset from '../../../../types/Asset';
import Consumption from '../../../../types/Consumption';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AssetValidator extends SchemaValidator {
  private static instance: AssetValidator|null = null;
  private createAssetConsumption: Schema;
  private assetGet: Schema;
  private assetsGet: Schema;
  private assetCreate: Schema;
  private assetUpdate: Schema;
  private assetGetConsumptions: Schema;

  private constructor() {
    super('AssetValidator');
    this.createAssetConsumption = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/create-asset-consumption.json`, 'utf8'));
    this.assetGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get.json`, 'utf8'));
    this.assetsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/assets-get.json`, 'utf8'));
    this.assetCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-create.json`, 'utf8'));
    this.assetUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-update.json`, 'utf8'));
    this.assetGetConsumptions = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset-get-consumptions.json`, 'utf8'));
  }

  public static getInstance(): AssetValidator {
    if (!AssetValidator.instance) {
      AssetValidator.instance = new AssetValidator();
    }
    return AssetValidator.instance;
  }

  public validateCreateAssetConsumption(data: any): Consumption {
    // Validate schema
    this.validate(this.createAssetConsumption, data);
    return data;
  }

  public validateAssetGetReq(data: any): HttpAssetRequest {
    // Validate schema
    this.validate(this.assetGet, data);
    return data;
  }

  public validateAssetsGetReq(data: any): HttpAssetsRequest {
    // Validate schema
    this.validate(this.assetsGet, data);
    return data;
  }

  public validateAssetCreateReq(data: any): Asset {
    // Validate schema
    this.validate(this.assetCreate, data);
    return data;
  }

  public validateAssetUpdateReq(data: any): Asset {
    // Validate schema
    this.validate(this.assetUpdate, data);
    return data;
  }

  public validateAssetGetConsumptionsReq(data: any): HttpAssetConsumptionRequest {
    // Validate schema
    this.validate(this.assetGetConsumptions, data);
    return data;
  }
}
