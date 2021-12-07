import { HttpSettingAssetSetRequest, HttpSettingBillingSetRequest, HttpSettingByIdentifierRequest, HttpSettingCarConnectorSetRequest, HttpSettingCryptoSetRequest, HttpSettingOCPISetRequest, HttpSettingOICPSetRequest, HttpSettingPricingSetRequest, HttpSettingRefundSetRequest, HttpSettingRequest, HttpSettingSacSetRequest, HttpSettingSmartChargingSetRequest, HttpSettingUserSetRequest, HttpSettingsRequest } from '../../../../types/requests/HttpSettingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SettingValidator extends SchemaValidator {
  private static instance: SettingValidator|null = null;
  private settingGetByID: Schema;
  private settingGetByIdentifier: Schema;
  private settingsGet: Schema;
  private settingOCPISet: Schema;
  private settingUserSet: Schema;
  private settingSmartChargingSet: Schema;
  private settingRefundSet: Schema;
  private settingPricingSet: Schema;
  private settingCryptoSet: Schema;
  private settingAnalyticsSet: Schema;
  private settingOICPSet: Schema;
  private settingBillingSet: Schema;
  private settingAssetSet: Schema;
  private settingCarConnectorSet: Schema;

  private constructor() {
    super('SettingValidator');
    this.settingGetByID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-by-id.json`, 'utf8'));
    this.settingGetByIdentifier = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-by-identifier.json`, 'utf8'));
    this.settingsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/settings-get.json`, 'utf8'));
    this.settingOCPISet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-ocpi-set.json`, 'utf8'));
    this.settingSmartChargingSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-smart-charging-set.json`, 'utf8'));
    this.settingUserSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-user-set.json`, 'utf8'));
    this.settingRefundSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-refund-set.json`, 'utf8'));
    this.settingPricingSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-pricing-set.json`, 'utf8'));
    this.settingCryptoSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-crypto-set.json`, 'utf8'));
    this.settingAnalyticsSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-analytics-set.json`, 'utf8'));
    this.settingOICPSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-oicp-set.json`, 'utf8'));
    this.settingBillingSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-billing-set.json`, 'utf8'));
    this.settingAssetSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-asset-set.json`, 'utf8'));
    this.settingCarConnectorSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-connector-set.json`, 'utf8'));
  }

  public static getInstance(): SettingValidator {
    if (!SettingValidator.instance) {
      SettingValidator.instance = new SettingValidator();
    }
    return SettingValidator.instance;
  }

  public validateSettingGetByIDReq(data: Record<string, unknown>): HttpSettingRequest {
    return this.validate(this.settingGetByID, data);
  }

  public validateSettingGetByIdentifierReq(data: Record<string, unknown>): HttpSettingByIdentifierRequest {
    return this.validate(this.settingGetByIdentifier, data);
  }

  public validateSettingsGetReq(data: Record<string, unknown>): HttpSettingsRequest {
    return this.validate(this.settingsGet, data);
  }

  public validateSettingOCPISetReq(data: Record<string, unknown>): HttpSettingOCPISetRequest {
    return this.validate(this.settingOCPISet, data);
  }

  public validateSettingUserSetReq(data: Record<string, unknown>): HttpSettingUserSetRequest {
    return this.validate(this.settingUserSet, data);
  }

  public validateSettingSmartChargingSetReq(data: Record<string, unknown>): HttpSettingSmartChargingSetRequest {
    return this.validate(this.settingSmartChargingSet, data);
  }

  public validateSettingRefundSetReq(data: Record<string, unknown>): HttpSettingRefundSetRequest {
    return this.validate(this.settingRefundSet, data);
  }

  public validateSettingPricingSetReq(data: Record<string, unknown>): HttpSettingPricingSetRequest {
    return this.validate(this.settingPricingSet, data);
  }

  public validateSettingCryptoSetReq(data: Record<string, unknown>): HttpSettingCryptoSetRequest {
    return this.validate(this.settingCryptoSet, data);
  }

  public validateSettingAnalyticsSetReq(data: Record<string, unknown>): HttpSettingSacSetRequest {
    return this.validate(this.settingAnalyticsSet, data);
  }

  public validateSettingOICPSetReq(data: Record<string, unknown>): HttpSettingOICPSetRequest {
    return this.validate(this.settingOICPSet, data);
  }

  public validateSettingBillingSetReq(data: Record<string, unknown>): HttpSettingBillingSetRequest {
    return this.validate(this.settingBillingSet, data);
  }

  public validateSettingAssetSetReq(data: Record<string, unknown>): HttpSettingAssetSetRequest {
    return this.validate(this.settingAssetSet, data);
  }

  public validateSettingCarConnectorSetReq(data: Record<string, unknown>): HttpSettingCarConnectorSetRequest {
    return this.validate(this.settingCarConnectorSet, data);
  }
}
