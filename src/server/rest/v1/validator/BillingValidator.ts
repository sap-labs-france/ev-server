import { HttpBillingInvoiceRequest, HttpBillingRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../types/requests/HttpBillingRequest';

import { BillingSettings } from '../../../../types/Setting';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class BillingValidator extends SchemaValidator {
  private static instance: BillingValidator|null = null;
  private billingSettingUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setting-update.json`, 'utf8'));
  private billingGetUserPaymentMethods: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-payment-methods-get.json`, 'utf8'));
  private billingDeleteUserPaymentMethod: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-delete-payment-method.json`, 'utf8'));
  private billingSetupUserPaymentMethod: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setup-payment-method.json`, 'utf8'));
  private billingInvoicesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/invoices-get.json`, 'utf8'));
  private billingInvoiceGetByID: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/invoice-get-by-id.json`, 'utf8'));

  private constructor() {
    super('BillingValidator');
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

  public validateBillingGetUserPaymentMethodsReq(data: Record<string, unknown>): HttpPaymentMethods {
    return this.validate(this.billingGetUserPaymentMethods, data);
  }

  public validateBillingDeleteUserPaymentMethodReq(data: Record<string, unknown>): HttpDeletePaymentMethod {
    return this.validate(this.billingDeleteUserPaymentMethod, data);
  }

  public validateBillingSetupUserPaymentMethodReq(data: Record<string, unknown>): HttpSetupPaymentMethod {
    return this.validate(this.billingSetupUserPaymentMethod, data);
  }

  public validateBillingInvoicesGetReq(data: Record<string, unknown>): HttpBillingInvoiceRequest {
    return this.validate(this.billingInvoicesGet, data);
  }

  public validateBillingInvoiceReq(data: Record<string, unknown>): HttpBillingRequest {
    return this.validate(this.billingInvoiceGetByID, data);
  }
}
