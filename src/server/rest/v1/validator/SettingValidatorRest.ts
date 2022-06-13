import { HttpSettingByIdentifierGetRequest, HttpSettingDeleteRequest, HttpSettingGetRequest, HttpSettingUpdateRequest, HttpSettingsGetRequest } from '../../../../types/requests/HttpSettingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SettingValidatorRest extends SchemaValidator {
  private static instance: SettingValidatorRest|null = null;
  private settingOCPISet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-ocpi-set.json`, 'utf8'));
  private settingSmartChargingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-smart-charging-set.json`, 'utf8'));
  private settingUserSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-user-set.json`, 'utf8'));
  private settingRefundSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-refund-set.json`, 'utf8'));
  private settingPricingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-pricing-set.json`, 'utf8'));
  private settingCryptoSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-crypto-set.json`, 'utf8'));
  private settingAnalyticsSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-analytics-set.json`, 'utf8'));
  private settingOICPSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-oicp-set.json`, 'utf8'));
  private settingBillingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-billing-set.json`, 'utf8'));
  private settingBillingPlatformSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-billing-platform-set.json`, 'utf8'));
  private settingAssetSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-asset-set.json`, 'utf8'));
  private settingCarConnectorSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-connector-set.json`, 'utf8'));
  private settingCarSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-set.json`, 'utf8'));
  private settingOrganizationSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-organization-set.json`, 'utf8'));
  private settingStatisticsSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-statistics-set.json`, 'utf8'));
  private settingGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-get.json`, 'utf8'));
  private settingDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-delete.json`, 'utf8'));
  private settingByIdentifierGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-by-identifier-get.json`, 'utf8'));
  private settingsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/settings-get.json`, 'utf8'));

  private constructor() {
    super('SettingValidatorRest');
  }

  public static getInstance(): SettingValidatorRest {
    if (!SettingValidatorRest.instance) {
      SettingValidatorRest.instance = new SettingValidatorRest();
    }
    return SettingValidatorRest.instance;
  }

  public validateSettingGetReq(data: Record<string, unknown>): HttpSettingGetRequest {
    return this.validate(this.settingGet, data);
  }

  public validateSettingDeleteReq(data: Record<string, unknown>): HttpSettingDeleteRequest {
    return this.validate(this.settingDelete, data);
  }

  public validateSettingGetByIdentifierReq(data: Record<string, unknown>): HttpSettingByIdentifierGetRequest {
    return this.validate(this.settingByIdentifierGet, data);
  }

  public validateSettingsGetReq(data: Record<string, unknown>): HttpSettingsGetRequest {
    return this.validate(this.settingsGet, data);
  }

  public validateSettingOCPISetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingOCPISet, data);
  }

  public validateSettingUserSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingUserSet, data);
  }

  public validateSettingSmartChargingSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingSmartChargingSet, data);
  }

  public validateSettingRefundSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingRefundSet, data);
  }

  public validateSettingPricingSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingPricingSet, data);
  }

  public validateSettingCryptoSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingCryptoSet, data);
  }

  public validateSettingAnalyticsSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingAnalyticsSet, data);
  }

  public validateSettingOICPSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingOICPSet, data);
  }

  public validateSettingBillingSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingBillingSet, data);
  }

  public validateSettingBillingPlatformSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingBillingPlatformSet, data);
  }

  public validateSettingAssetSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingAssetSet, data);
  }

  public validateSettingCarConnectorSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingCarConnectorSet, data);
  }

  public validateSettingCarSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingCarSet, data);
  }

  public validateSettingOrganizationSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingOrganizationSet, data);
  }

  public validateSettingStatisticsSetReq(data: Record<string, unknown>): HttpSettingUpdateRequest {
    return this.validate(this.settingStatisticsSet, data);
  }
}
