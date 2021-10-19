import { HttpSettingCryptoSetRequest, HttpSettingOCPISetRequest, HttpSettingPricingSetRequest, HttpSettingRefundSetRequest, HttpSettingSmartChargingSetRequest, HttpSettingUserSetRequest } from '../../../../types/requests/HttpSettingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
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

  private constructor() {
    super('SettingValidator');
    this.settingOCPISet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-ocpi-set.json`, 'utf8'));
    this.settingSmartChargingSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-smart-charging-set.json`, 'utf8'));
    this.settingUserSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-user-set.json`, 'utf8'));
    this.settingRefundSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-refund-set.json`, 'utf8'));
    this.settingPricingSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-pricing-set.json`, 'utf8'));
    this.settingCryptoSet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-crypto-set.json`, 'utf8'));
  }

  public static getInstance(): SettingValidator {
    if (!SettingValidator.instance) {
      SettingValidator.instance = new SettingValidator();
    }
    return SettingValidator.instance;
  }

  public validateSettingOCPISetReq(data: Record<string, unknown>): HttpSettingOCPISetRequest {
    return this.validate(this.settingOCPISet, data);
  }

  public validateSettingUserSetReq(data: Record<string, unknown>): HttpSettingUserSetRequest {
    return this.validate(this.settingUserSet, data);
  }

  public validateSettingSmartChargingSetReq(data: Record<string, unknown>): HttpSettingSmartChargingSetRequest {
    return this.validate(this.settingUserSet, data);
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
}
