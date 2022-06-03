import { BillingInvoiceStatus } from '../Billing';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBillingInvoiceRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingInvoicesRequest extends HttpDatabaseRequest {
  UserID?: string;
  Status?: BillingInvoiceStatus;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
  ID?: string;
}

export interface HttpSetupPaymentMethod {
  userID: string;
  paymentMethodId?: string;
}

export interface HttpPaymentMethods {
  userID: string;
}

export interface HttpDeletePaymentMethod {
  userID: string;
  paymentMethodId: string;
}

export interface HttpBillingSubAccountCreateRequest {
  userID: string;
}

export interface HttpBillingSubAccountActivateRequest {
  ID: string;
  TenantID: string;
}

export interface HttpBillingSubAccountsGetRequest extends HttpDatabaseRequest {
  SubAccountID?: string;
  UserID?: string;
  Status?: BillingInvoiceStatus;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}
