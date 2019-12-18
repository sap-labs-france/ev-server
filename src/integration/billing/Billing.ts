import { Request } from 'express';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import {
  BillingDataStart,
  BillingDataStop,
  BillingDataUpdate,
  BillingResponse,
  BillingUserData,
  PartialBillingTax
} from '../../types/Billing';
import {BillingSetting, BillingSettings} from '../../types/Setting';

export default abstract class Billing<T extends BillingSetting> {

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
  async abstract getUpdatedUsersInBillingForSynchronization(): Promise<string[]>;

  // eslint-disable-next-line no-unused-vars
  async abstract synchronizeUser(user: User): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract finalizeSynchronization(): Promise<void>;

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

  async abstract getUsers(): Promise<Partial<User>[]>;

  async abstract createUser(req: Request): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateUser(user: User, req: Request): Promise<BillingUserData>;

  // eslint-disable-next-line no-unused-vars
  async abstract deleteUser(user: User, req: Request): Promise<void>;

  async abstract getTaxes(): Promise<PartialBillingTax[]>;

}
