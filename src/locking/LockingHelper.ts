import Lock, { LockEntity } from '../types/Locking';

import Asset from '../types/Asset';
import LockingManager from './LockingManager';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import SiteArea from '../types/SiteArea';

export default class LockingHelper {
  public static async createSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`);
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

  public static async createAssetRetrieveConsumptionsLock(tenantID: string, asset: Asset): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASSET, `${asset.id}-consumptions`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIEndpointActionLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, action: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OCPI_ENDPOINT, `${ocpiEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }
}
