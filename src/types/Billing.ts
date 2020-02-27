import BackendError from '../exception/BackendError';

export interface BillingTransactionData {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
  cancelTransaction?: boolean;
}

export interface BillingDataUpdate {
  cancelTransaction?: boolean;
}

export interface BillingDataStop {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
}

export interface BillingUserData {
  customerID?: string;
  method?: string;
  cardID?: string;
  subscriptionID?: string;
  lastChangedOn?: Date;
  hasSynchroError?: boolean;
}

export interface BillingPartialUser {
  email: string;
  name: string;
  billingData: BillingUserData;
}

export interface BillingUserSynchronizeAction {
  synchronized: number;
  error: number;
  billingData?: BillingUserData;
}

export interface BillingTax {
  id: string;
  description: string;
  displayName: string;
  percentage: number;
}

export enum BillingConnectionErrorType {
  NO_SECRET_KEY = 'no_secret_key',
  NO_PUBLIC_KEY = 'no_public_key',
  INVALID_SECRET_KEY = 'invalid_secret_key',
  INVALID_PUBLIC_KEY = 'invalid_public_key',
}

export interface BillingConnectionStatus {
  connectionValid: boolean;
  errorType?: BillingConnectionErrorType;
  error?: BackendError;
}
