import { ActionsResponse, DocumentEncoding, DocumentType } from './GlobalType';

import User from './User';

export interface BillingTransactionData {
  status?: string;
  invoiceID?: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceItem?: BillingInvoiceItem;
  lastUpdate?: Date;
}

export interface BillingDataTransactionStart {
  cancelTransaction?: boolean;
}

export interface BillingDataTransactionUpdate {
  cancelTransaction?: boolean;
}

export enum BillingStatus {
  UNBILLED = 'unbilled',
  BILLED = 'billed',
}

export enum BillingMethod {
  IMMEDIATE = 'immediate',
  PERIODIC = 'periodic',
  ADVANCE = 'advance',
}


export interface BillingDataTransactionStop {
  status?: string;
  invoiceID?: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceItem?: BillingInvoiceItem;
}

export interface BillingUserData {
  customerID?: string;
  lastChangedOn?: Date;
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
  userID?: string;
  user?: User;
  number?: string;
  status?: BillingInvoiceStatus;
  amount?: number;
  amountPaid?: number;
  currency?: string;
  customerID?: string;
  createdOn?: Date;
  nbrOfItems?: number;
  downloadable?: boolean
  downloadUrl?: string;
}

export interface BillingInvoiceItem {
  description: string;
  pricingData: {
    quantity: number,
    amount: number,
    currency: string
  }
  taxes?: string[];
  metadata?: {
    // Just a flat list of key/value pairs!
    [name: string]: string | number | null;
  }
}

export enum BillingInvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
  DRAFT = 'draft',
}

export interface BillingInvoiceDocument {
  id: string;
  invoiceID: string;
  content: string; // Base64 format
  type: DocumentType;
  encoding: DocumentEncoding;
}

export interface BillingOperationResult {
  succeeded: boolean
  error?: {
    message: string
  };
  internalData?: unknown; // Object returned by the concrete implementation - e.g.: STRIPE
}
