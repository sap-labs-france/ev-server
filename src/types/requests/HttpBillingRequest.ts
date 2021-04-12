import { BillingInvoiceStatus } from '../Billing';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBillingRequest {
}

export interface HttpBillingInvoiceRequest extends HttpDatabaseRequest {
  UserID?: string;
  Status?: BillingInvoiceStatus;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}

export interface HttpBillingWebHookRequest {
  tenantID?: string
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
