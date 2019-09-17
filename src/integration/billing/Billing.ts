import { Request } from 'express';
import Transaction from '../../types/Transaction';
import User from '../../types/User';

export interface BillingSettings {
  currency: string; // Must come from 'pricing' settings!
}

export interface BillingConnection {
  connectionIsValid: boolean;
  message: string;
}

export interface BillingData {
  method: string;
  customerID: string;
  cardID: string;
  subscriptionID: string;
  lastUpdate: Date;
  // Etc., also in User and Transaction interfaces
}

export interface BillingDataStart {
  statusCode: string;
}

export interface BillingDataUpdate {
  statusCode: string;
  stopTransaction: boolean;
}

export interface BillingDataStop {
  statusCode: string;
  invoiceStatus: string;
  invoiceItem: string;
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
  async abstract checkConnection(key?: string): Promise<BillingConnection>;

  // eslint-disable-next-line no-unused-vars
  async abstract startSession(user: User, transaction: Transaction): Promise<BillingDataStart>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateSession(transaction: Transaction): Promise<BillingDataUpdate>;

  // eslint-disable-next-line no-unused-vars
  async abstract stopSession(transaction: Transaction): Promise<BillingDataStop>;

  // eslint-disable-next-line no-unused-vars
  async abstract checkIfUserCanBeCreated(req: Request): Promise<void>;

  // eslint-disable-next-line no-unused-vars
  async abstract createUser(req: Request): Promise<BillingData>;

  async abstract checkIfUserCanBeUpdated(user: User, req: Request, createUser?: boolean): Promise<void>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateUser(user: User, req: Request): Promise<BillingData>;

  // eslint-disable-next-line no-unused-vars
  async abstract checkIfUserCanBeDeleted(user: User, req: Request): Promise<void>;

  // eslint-disable-next-line no-unused-vars
  async abstract deleteUser(user: User, req: Request): Promise<void>;

}
