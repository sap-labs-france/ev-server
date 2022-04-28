import { HttpSettingByIdentifierRequest, HttpSettingRequest, HttpSettingsRequest } from '../../../../types/requests/HttpSettingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import { SettingDB } from '../../../../types/Setting';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SettingValidator extends SchemaValidator {
  private static instance: SettingValidator|null = null;
  private settingOCPISet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-ocpi-set.json`, 'utf8'));
  private settingSmartChargingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-smart-charging-set.json`, 'utf8'));
  private settingUserSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-user-set.json`, 'utf8'));
  private settingRefundSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-refund-set.json`, 'utf8'));
  private settingPricingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-pricing-set.json`, 'utf8'));
  private settingCryptoSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-crypto-set.json`, 'utf8'));
  private settingAnalyticsSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-analytics-set.json`, 'utf8'));
  private settingOICPSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-oicp-set.json`, 'utf8'));
  private settingBillingSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-billing-set.json`, 'utf8'));
  private settingAssetSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-asset-set.json`, 'utf8'));
  private settingCarConnectorSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-connector-set.json`, 'utf8'));
  private settingCarSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-set.json`, 'utf8'));
  private settingOrganizationSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-organization-set.json`, 'utf8'));
  private settingStatisticsSet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-statistics-set.json`, 'utf8'));
  private settingGetByID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-by-id.json`, 'utf8'));
  private settingGetByIdentifier = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-by-identifier.json`, 'utf8'));
  private settingsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/settings-get.json`, 'utf8'));
  private settingMobileAppSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-mobile-app-set.json`, 'utf8'));

  private constructor() {
    super('SettingValidator');
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

  public validateSettingOCPISetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingOCPISet, data);
  }

  public validateSettingUserSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingUserSet, data);
  }

  public validateSettingSmartChargingSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingSmartChargingSet, data);
  }

  public validateSettingRefundSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingRefundSet, data);
  }

  public validateSettingPricingSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingPricingSet, data);
  }

  public validateSettingCryptoSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingCryptoSet, data);
  }

  public validateSettingAnalyticsSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingAnalyticsSet, data);
  }

  public validateSettingOICPSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingOICPSet, data);
  }

  public validateSettingBillingSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingBillingSet, data);
  }

  public validateSettingAssetSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingAssetSet, data);
  }

  public validateSettingCarConnectorSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingCarConnectorSet, data);
  }

  public validateSettingCarSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingCarSet, data);
  }

  public validateSettingOrganizationSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingOrganizationSet, data);
  }

  public validateSettingStatisticsSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingStatisticsSet, data);
  }

  public validateSettingMobileAppSetReq(data: Record<string, unknown>): SettingDB {
    return this.validate(this.settingMobileAppSet, data);
  }
}
