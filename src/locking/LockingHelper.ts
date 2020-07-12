import Lock, { LockEntity } from '../types/Locking';

import LockingManager from './LockingManager';
import SiteArea from '../types/SiteArea';

export default class LockingHelper {
  public static async createSiteAreaLock(tenantID: string, siteArea: SiteArea): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, siteArea.id);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncUsersLock(tenantID: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'synchronize-billing-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncInvoicesLock(tenantID: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.INVOICE, 'synchronize-billing-invoices');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }
}
