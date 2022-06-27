import { HttpBillingInvoiceRequest, HttpBillingInvoicesRequest, HttpBillingSubAccountActivateRequest, HttpBillingSubAccountCreateRequest, HttpBillingSubAccountGetRequest, HttpBillingSubAccountsGetRequest, HttpBillingTransferFinalizeRequest, HttpBillingTransfersGetRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../types/requests/HttpBillingRequest';

import { BillingSettings } from '../../../../types/Setting';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class BillingValidatorRest extends SchemaValidator {
  private static instance: BillingValidatorRest|null = null;
  private billingSettingUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setting-update.json`, 'utf8'));
  private billingGetUserPaymentMethods: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-payment-methods-get.json`, 'utf8'));
  private billingDeleteUserPaymentMethod: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-delete-payment-method.json`, 'utf8'));
  private billingSetupUserPaymentMethod: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setup-payment-method.json`, 'utf8'));
  private billingInvoicesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/invoices-get.json`, 'utf8'));
  private billingInvoiceGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/invoice-get.json`, 'utf8'));
  private billingCreateSubAccount: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-create-sub-account.json`, 'utf8'));
  private billingActivateSubAccount: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-activate-sub-account.json`, 'utf8'));
  private billingSubAccountsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-sub-accounts-get.json`, 'utf8'));
  private billingSubAccountGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-sub-account-get.json`, 'utf8'));
  private billingTransfersGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfers-get.json`, 'utf8'));
  private billingTransferFinalize: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfer-finalize.json`, 'utf8'));

  private constructor() {
    super('BillingValidatorRest');
  }

  public static getInstance(): BillingValidatorRest {
    if (!BillingValidatorRest.instance) {
      BillingValidatorRest.instance = new BillingValidatorRest();
    }
    return BillingValidatorRest.instance;
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

  public validateBillingInvoicesGetReq(data: Record<string, unknown>): HttpBillingInvoicesRequest {
    return this.validate(this.billingInvoicesGet, data);
  }

  public validateBillingInvoiceGetReq(data: Record<string, unknown>): HttpBillingInvoiceRequest {
    return this.validate(this.billingInvoiceGet, data);
  }

  public validateBillingCreateSubAccountReq(data: Record<string, unknown>): HttpBillingSubAccountCreateRequest {
    return this.validate(this.billingCreateSubAccount, data);
  }

  public validateBillingActivateSubAccountReq(data: Record<string, unknown>): HttpBillingSubAccountActivateRequest {
    return this.validate(this.billingActivateSubAccount, data);
  }

  public validateBillingSubAccountsGetReq(data: Record<string, unknown>): HttpBillingSubAccountsGetRequest {
    return this.validate(this.billingSubAccountsGet, data);
  }

  public validateBillingSubAccountGetReq(data: Record<string, unknown>): HttpBillingSubAccountGetRequest {
    return this.validate(this.billingSubAccountGet, data);
  }

  public validateBillingTransfersGetReq(data: Record<string, unknown>): HttpBillingTransfersGetRequest {
    return this.validate(this.billingTransfersGet, data);
  }

  public validateBillingTransferFinalizeReq(data: Record<string, unknown>): HttpBillingTransferFinalizeRequest {
    return this.validate(this.billingTransferFinalize, data);
  }
}
