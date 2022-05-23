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

export interface HttpBillingSubAccountCreate {
  userID: string;
}

export interface HttpBillingSubAccountActivate {
  ID: string;
  TenantID: string;
}
