import { ActionsResponse } from './GlobalType';
import { PricedConsumptionData } from './Pricing';
import User from './User';

export interface TransactionBillingData {
  withBillingActive?: boolean;
  lastUpdate?: Date;
  stop?: BillingDataTransactionStop;
}

export interface BillingDataTransactionStart {
  withBillingActive: boolean;
}

export interface BillingDataTransactionUpdate {
  withBillingActive: boolean;
}

export enum BillingStatus {
  UNBILLED = 'unbilled',
  BILLED = 'billed',
  PENDING = 'pending',
  FAILED = 'failed',
}
export interface BillingDataTransactionStop {
  status?: string;
  invoiceID?: string;
  invoiceNumber?: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceItem?: BillingInvoiceItem;
}

export interface BillingUserData {
  customerID: string;
  liveMode: boolean;
  lastChangedOn: Date;
  hasSynchroError?: boolean;
  invoicesLastSynchronizedOn?: Date;
}

export interface BillingUser {
  userID: string; // Added to make it easier to find the corresponding eMobility user data
  // email: string;
  name: string;
  billingData: BillingUserData;
}

export interface BillingUserSynchronizeAction extends ActionsResponse {
  billingData?: BillingUserData;
}

export interface BillingChargeInvoiceAction extends ActionsResponse {
  billingData?: BillingUserData;
}

export interface BillingTax {
  id: string;
  description: string;
  displayName: string;
  percentage: number;
}

export interface BillingInvoice {
  id: string;
  invoiceID: string;
  liveMode: boolean;
  userID?: string;
  user?: User;
  // eslint-disable-next-line id-blacklist
  number?: string;
  status?: BillingInvoiceStatus;
  amount?: number;
  amountPaid?: number;
  currency?: string;
  customerID?: string;
  createdOn?: Date;
  downloadable?: boolean
  downloadUrl?: string;
  sessions?: BillingSessionData[];
  lastError?: BillingError;
  payInvoiceUrl?: string;
}

export interface BillingInvoiceItem {
  transactionID: number;
  currency: string;
  pricingData: PricedConsumptionData[]
  headerDescription?: string,
  metadata?: {
    // Just a flat list of key/value pairs!
    [name: string]: string | number | null;
  }
}

export interface BillingSessionData {
  transactionID: number;
  pricingData: PricedConsumptionData[];
}

export enum BillingInvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
  DRAFT = 'draft',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
  DELETED = 'deleted',
}

export interface BillingOperationResult {
  succeeded: boolean
  error?: Error
  internalData?: unknown // an object returned by the concrete implementation - e.g.: STRIPE
}

export interface BillingPaymentMethod {
  id: string;
  brand: string;
  expiringOn: Date;
  last4: string;
  type: string;
  createdOn: Date;
  isDefault: boolean;
}

export interface BillingError {
  // Billing Error should expose the information which is common to all payment platforms
  message: string
  when: Date
  errorType: BillingErrorType, // SERVER or APPLICATION errors
  errorCode: BillingErrorCode, // More information about the root cause
  rootCause?: unknown; // The original error from the payment platform
}

export enum BillingErrorType {
  APPLICATION_ERROR = 'application_error', // This is not a STRIPE error
  PLATFORM_SERVER_ERROR = 'platform_server_error', // Errors 500, server is down or network issues
  PLATFORM_APPLICATION_ERROR = 'platform_error', // This is a STRIPE error
  PLATFORM_PAYMENT_ERROR = 'payment_error',
}

export enum BillingErrorCode {
  UNKNOWN_ERROR = 'unknown',
  UNEXPECTED_ERROR = 'unexpected',
  NO_PAYMENT_METHOD = 'no_payment_method',
  CARD_ERROR = 'card_error',
}

export interface BillingAdditionalData {
  session?: BillingSessionData,
  lastError?: BillingError,
}

