import { AuthorizationActions, BillingInvoiceAuthorizationActions, BillingTaxAuthorizationActions, BillingTransferAuthorizationActions } from './Authorization';

import { ActionsResponse } from './GlobalType';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Decimal from 'decimal.js';
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
  transferID?: string;
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

export interface BillingTax extends BillingTaxAuthorizationActions {
  id: string;
  description: string;
  displayName: string;
  percentage: number;
}

export interface BillingInvoice extends CreatedUpdatedProps, BillingInvoiceAuthorizationActions {
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
  accountData?: BillingSessionAccountData; // Each session may target a distinct account - but the 4 pricing dimensions MUST share the same info
  headerDescription?: string,
  metadata?: {
    // Just a flat list of key/value pairs!
    [name: string]: string | number | null;
  }
}

export interface BillingSessionData {
  transactionID: number;
  pricingData: PricedConsumptionData[];
  accountData?: BillingSessionAccountData; // Each session may target a distinct account
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

export interface BillingPaymentMethod extends AuthorizationActions {
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

export enum BillingAccountStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  ACTIVE = 'active'
}

export interface BillingPlatformFeeStrategy {
  flatFeePerSession: number; // e.g.: 0.25 per charging session
  percentage: number; // e.g.: 2% per charging session
}

export interface BillingAccount extends CreatedUpdatedProps, BillingTransferAuthorizationActions {
  id?: string;
  businessOwnerID: string;
  businessOwner?: User;
  companyName: string;
  status: BillingAccountStatus;
  activationLink?: string;
  accountExternalID: string;
}

export interface BillingAccountData {
  accountID: string;
  account?: BillingAccount;
  platformFeeStrategy?: BillingPlatformFeeStrategy;
}

export interface BillingSessionAccountData extends BillingAccountData {
  withTransferActive: boolean,
  feeAmount?: number
}

export enum BillingTransferStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  FINALIZED = 'finalized',
  TRANSFERRED = 'transferred'
}

// TODO - TO BE CLARIFIED - REDUNDANT INFORMATION
export interface BillingPlatformFeeData {
  feeAmount: number;
  feeTaxAmount: number;
}

export interface BillingTransfer extends CreatedUpdatedProps, BillingTransferAuthorizationActions {
  id?: string;
  status: BillingTransferStatus;
  sessionCounter: number, // Number of transactions
  collectedFunds: number, // Total amount of the priced transactions
  collectedFlatFees: number,
  collectedFees: number, // Total amount of the platform fee collected
  totalConsumptionWh: number,
  totalDurationSecs: number,
  transferAmount: number // Amount transferred after applying platform fees
  accountID: string;
  account?: BillingAccount;
  businessOwner?: User;
  platformFeeData: BillingPlatformFeeData;
  transferExternalID: string; // Transfer sent to the CPO
  currency: string;
  invoice?: BillingPlatformInvoice; // The invoice generated to bill the platform fee
}

// Very important - preserve maximal precision - Decimal type is persisted as an object in the DB
export type BillingAmount = Decimal.Value;

export interface BillingPlatformInvoice {
  invoiceID: string;
  liveMode: boolean;
  userID: string;
  documentNumber: string;
  status: BillingInvoiceStatus;
  amount: number; // This one is in cents
  totalAmount: number;
  currency: string;
  customerID: string;
  createdOn: Date;
}

