import { ActionsResponse } from './GlobalType';

export interface BillingTransactionData {
  status?: string;
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
  invoiceStatus?: BillingInvoiceStatus;
  invoiceItem?: BillingInvoiceItem;
}

export interface BillingUserData {
  customerID?: string;
  method?: string;
  cardID?: string;
  subscriptionID?: string;
  lastChangedOn?: Date;
  hasSynchroError?: boolean;
  invoicesLastSynchronizedOn?: Date;
}

export interface BillingUser {
  email: string;
  name: string;
  billingData: BillingUserData;
}

export interface BillingUserSynchronizeAction extends ActionsResponse {
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
  number?: string;
  status?: BillingInvoiceStatus;
  amount?: number;
  currency?: string;
  customerID?: string;
  createdOn?: Date;
  nbrOfItems?: number;
}

export interface BillingInvoiceItem {
  description: string;
  amount: number;
  taxes?: string[];
}

export enum BillingInvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
  DRAFT = 'draft',
}
