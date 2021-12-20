import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import { SettingDB } from '../../../../types/Setting';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SettingValidator extends SchemaValidator {
  private static instance: SettingValidator|null = null;
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
  private settingCarSet: Schema;
  private settingOrganizationSet: Schema;
  private settingStatisticsSet: Schema;

  private constructor() {
    super('SettingValidator');
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
    this.settingCarSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-car-set.json`, 'utf8'));
    this.settingOrganizationSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-organization-set.json`, 'utf8'));
    this.settingStatisticsSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-statistics-set.json`, 'utf8'));
  }

  public static getInstance(): SettingValidator {
    if (!SettingValidator.instance) {
      SettingValidator.instance = new SettingValidator();
    }
    return SettingValidator.instance;
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
}
