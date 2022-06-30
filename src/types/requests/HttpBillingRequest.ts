import { BillingAccount, BillingInvoiceStatus } from '../Billing';

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

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpBillingSubAccountCreateRequest extends BillingAccount {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpBillingSubAccountUpdateRequest extends BillingAccount {
}

export interface HttpBillingSubAccountActivateRequest {
  ID: string;
}

export interface HttpBillingSubAccountsGetRequest extends HttpDatabaseRequest {
  ID?: string;
  UserID?: string;
  Status?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}

export interface HttpBillingSubAccountGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingTransfersGetRequest extends HttpDatabaseRequest {
  ID?: string;
  AccountID?: string;
  Status?: string;
  TransferExternalID?: string;
  Search?: string;
}

export interface HttpBillingTransferFinalizeRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingTransferSendRequest extends HttpByIDRequest {
  ID: string;
}
