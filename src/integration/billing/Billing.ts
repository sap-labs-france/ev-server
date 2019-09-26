import { Request } from 'express';
import Transaction from '../../types/Transaction';
import User from '../../types/User';

export interface BillingSettings {
  currency: string; // Must come from 'pricing' settings!
}

export interface BillingResponse {
  success: boolean;
  message?: string;
}

export interface BillingTransactionData {
  status?: string;
  errorCode?: string;
  errorCodeDesc?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
  errorCode?: string;
  errorCodeDesc?: string;
}

export interface BillingDataUpdate {
  errorCode?: string;
  errorCodeDesc?: string;
  stopTransaction?: boolean;
}

export interface BillingDataStop {
  status?: string;
  errorCode?: string;
  errorCodeDesc?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
}

export interface BillingUserData {
  customerID?: string;
  method?: string;
  cardID?: string;
  subscriptionID?: string;
  lastChangedOn?: Date;
}

export interface BillingUpdatedCustomer {
  customerID?: string;
  cardID?: string;
  subscriptionID?: string;
}

export default abstract class Billing<T extends BillingSettings> {

  // Protected because only used in subclasses at the moment
  protected readonly tenantId: string; // Assuming GUID or other string format ID
  protected settings: T;

  constructor(tenantId: string, settings: T) {
    this.tenantId = tenantId;
    this.settings = settings;
  }

  getSettings(): T {
    return this.settings;
  }

  // eslint-disable-next-line no-unused-vars
  async abstract checkConnection(key?: string): Promise<BillingResponse>;

  // eslint-disable-next-line no-unused-vars
  async abstract synchronizeUser(user: User): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract getUpdatedCustomers(exclCustomers?: string[]): Promise<BillingUpdatedCustomer[]>;

  // eslint-disable-next-line no-unused-vars
  async abstract startTransaction(user: User, transaction: Transaction): Promise<BillingDataStart>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateTransaction(transaction: Transaction): Promise<BillingDataUpdate>;

  // eslint-disable-next-line no-unused-vars
  async abstract stopTransaction(transaction: Transaction): Promise<BillingDataStop>;

  // eslint-disable-next-line no-unused-vars
  async abstract checkIfUserCanBeCreated(req: Request): Promise<void>;

  // eslint-disable-next-line no-unused-vars
  async abstract checkIfUserCanBeUpdated(user: User, req: Request): Promise<void>;

  // eslint-disable-next-line no-unused-vars
  async abstract checkIfUserCanBeDeleted(user: User, req: Request): Promise<void>;

  async abstract createUser(req: Request): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateUser(user: User, req: Request): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract deleteUser(user: User, req: Request): Promise<void>;

}
