import { Request } from 'express';
import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingPartialUser, BillingUserData } from '../../types/Billing';
import { BillingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import { PartialBillingTax } from '../../types/Billing';

export default abstract class Billing<T extends BillingSetting> {

  // Protected because only used in subclasses at the moment
  protected readonly tenantID: string; // Assuming GUID or other string format ID
  protected settings: T;

  constructor(tenantID: string, settings: T) {
    this.tenantID = tenantID;
    this.settings = settings;
  }

  getSettings(): T {
    return this.settings;
  }

  async abstract checkConnection();

  async abstract getUpdatedUserIDsInBilling(): Promise<string[]>;

  async abstract startTransaction(transaction: Transaction): Promise<BillingDataStart>;

  async abstract updateTransaction(transaction: Transaction): Promise<BillingDataUpdate>;

  async abstract stopTransaction(transaction: Transaction): Promise<BillingDataStop>;

  async abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  async abstract getUser(id: string): Promise<BillingPartialUser>;

  async abstract getUserbyEmail(email: string): Promise<BillingPartialUser>;

  async abstract getUsers(): Promise<BillingPartialUser[]>;

  async abstract createUser(user: User): Promise<BillingUserData>;

  async abstract updateUser(user: User): Promise<BillingUserData>;

  async abstract deleteUser(user: User);

  async abstract userExists(user: User): Promise<boolean>;

  async abstract getTaxes(): Promise<PartialBillingTax[]>;

}
