import { ActionsResponse } from './GlobalType';
import HttpDatabaseRequest from "./requests/HttpDatabaseRequest";

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

export interface HttpBillingInvoiceRequest extends HttpDatabaseRequest {
  status?: BillingInvoiceStatus;
  startDateTime?: Date;
  endDateTime?: Date;
}
