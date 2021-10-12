import { BillingSettings } from '../../../../types/Setting';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class BillingValidator extends SchemaValidator {
  private static instance: BillingValidator|null = null;
  private billingSettingUpdate: Schema;

  private constructor() {
    super('BillingValidator');
    this.billingSettingUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setting-update.json`, 'utf8'));
  }

  public static getInstance(): BillingValidator {
    if (!BillingValidator.instance) {
      BillingValidator.instance = new BillingValidator();
    }
    return BillingValidator.instance;
  }

  public validateBillingSettingUpdateReq(data: Record<string, unknown>): BillingSettings {
    return this.validate(this.billingSettingUpdate, data);
  }
}
