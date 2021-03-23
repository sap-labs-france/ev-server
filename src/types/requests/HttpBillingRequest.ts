import { BillingInvoiceStatus } from '../Billing';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import UserToken from '../UserToken';

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
  user: UserToken;
  currentUserID: string;
  paymentMethodId?: string;
}

export interface HttpPaymentMethods {
  loggedUser: UserToken;
  selectedUserID: string;
}

export interface HttpDeletePaymentMethod {
  loggedUser: UserToken;
  paymentMethodId: string;
}
