import { HttpBillingAccountActivateRequest, HttpBillingAccountCreateRequest, HttpBillingAccountGetRequest, HttpBillingAccountsGetRequest, HttpBillingInvoiceRequest, HttpBillingInvoicesRequest, HttpBillingTransferFinalizeRequest, HttpBillingTransferGetRequest, HttpBillingTransferSendRequest, HttpBillingTransfersGetRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../types/requests/HttpBillingRequest';

import { BillingSettings } from '../../../../types/Setting';
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
  private billingCreateAccount: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-create-account.json`, 'utf8'));
  private billingActivateAccount: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-activate-account.json`, 'utf8'));
  private billingAccountsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-accounts-get.json`, 'utf8'));
  private billingAccountGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-account-get.json`, 'utf8'));
  private billingTransfersGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfers-get.json`, 'utf8'));
  private billingTransferGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfer-get.json`, 'utf8'));
  private billingTransferFinalize: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfer-finalize.json`, 'utf8'));
  private billingTransferSend: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-transfer-send.json`, 'utf8'));

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

  public validateBillingCreateAccountReq(data: Record<string, unknown>): HttpBillingAccountCreateRequest {
    return this.validate(this.billingCreateAccount, data);
  }

  public validateBillingActivateAccountReq(data: Record<string, unknown>): HttpBillingAccountActivateRequest {
    return this.validate(this.billingActivateAccount, data);
  }

  public validateBillingAccountsGetReq(data: Record<string, unknown>): HttpBillingAccountsGetRequest {
    return this.validate(this.billingAccountsGet, data);
  }

  public validateBillingAccountGetReq(data: Record<string, unknown>): HttpBillingAccountGetRequest {
    return this.validate(this.billingAccountGet, data);
  }

  public validateBillingTransfersGetReq(data: Record<string, unknown>): HttpBillingTransfersGetRequest {
    return this.validate(this.billingTransfersGet, data);
  }

  public validateBillingTransferGetReq(data: Record<string, unknown>): HttpBillingTransferGetRequest {
    return this.validate(this.billingTransferGet, data);
  }

  public validateBillingTransferFinalizeReq(data: Record<string, unknown>): HttpBillingTransferFinalizeRequest {
    return this.validate(this.billingTransferFinalize, data);
  }

  public validateBillingTransferSendReq(data: Record<string, unknown>): HttpBillingTransferSendRequest {
    return this.validate(this.billingTransferSend, data);
  }
}
