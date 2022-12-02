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
  paymentMethodID?: string;
  paymentIntentID?: string;
}

export interface HttpPaymentMethods {
  userID: string;
  WithAuth: boolean;
}

export interface HttpDeletePaymentMethod {
  userID: string;
  paymentMethodId: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpBillingAccountCreateRequest extends BillingAccount {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpBillingAccountUpdateRequest extends BillingAccount {
}

export interface HttpBillingAccountActivateRequest {
  ID: string;
}

export interface HttpBillingAccountsGetRequest extends HttpDatabaseRequest {
  ID?: string;
  UserID?: string;
  Status?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}

export interface HttpBillingAccountGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingTransfersGetRequest extends HttpDatabaseRequest {
  ID?: string;
  AccountID?: string;
  Status?: string;
  TransferExternalID?: string;
  Search?: string;
}

export interface HttpBillingTransferGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingTransferFinalizeRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpBillingTransferSendRequest extends HttpByIDRequest {
  ID: string;
}


export interface HttpBillingScanPayRequest {
  firstName?: string;
  name?: string;
  siteAreaID: string;
  subdomain: string;
  email: string;
  locale: string;
  paymentMethodID?: string;
  paymentIntentID?: string;
  connectorID?: number;
  chargingStationID?: string;
}

export interface HttpBillingScanPayStopTransactionRequest {
  transactionId: number;
  email: string;
  subdomain: string;
}
