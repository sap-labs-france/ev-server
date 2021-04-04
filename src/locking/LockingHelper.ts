import Lock, { LockEntity } from '../types/Locking';

import Asset from '../types/Asset';
import AsyncTask from '../types/AsyncTask';
import LockingManager from './LockingManager';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import OICPEndpoint from '../types/oicp/OICPEndpoint';
import SiteArea from '../types/SiteArea';

export default class LockingHelper {
  public static async tryCreateSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea, timeout: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`);
    if (!(await LockingManager.tryAcquire(lock, timeout))) {
      return null;
    }
    return lock;
  }

  public static async createAsyncTaskLock(tenantID: string, asyncTask: AsyncTask): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASYNC_TASK, `${asyncTask.id}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncUsersLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'synchronize-billing-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createImportUsersLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'import-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createImportTagsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TAG, 'import-tags');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createSyncCarCatalogsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.CAR_CATALOG, 'synchronize-car-catalogs');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncInvoicesLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.INVOICE, 'synchronize-billing-invoices');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createAssetRetrieveConsumptionsLock(tenantID: string, asset: Asset): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASSET, `${asset.id}-consumptions`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPushCpoCdrsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, 'push-cdrs');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPushTokensLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'push-tokens');
  }

  public static async createOCPIPushCdrLock(tenantID: string, transactionID: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPullTokensLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, partial: boolean): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, `pull-tokens${partial ? '-partial' : ''}`);
  }

  public static async createOCPICheckCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-cdrs');
  }

  public static async createOCPICheckLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-locations');
  }

  public static async createOCPICheckSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-sessions');
  }

  public static async createOCPIPullCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-cdrs');
  }

  public static async createOCPIPullLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-locations');
  }

  public static async createOCPIPullSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-sessions');
  }

  public static async createOCPIPatchLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'patch-locations');
  }

  public static async createOCPIPatchEVSEStatusesLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock|null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'patch-evse-statuses');
  }

  public static async createOICPPatchEVSEsLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.createOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-evses');
  }

  public static async createOICPPatchEvseStatusesLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.createOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-evse-statuses');
  }

  public static async createOICPPushCdrLock(tenantID: string, transactionID: number): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  private static async createOCPIEndpointActionLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, action: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OCPI_ENDPOINT, `${ocpiEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  private static async createOICPEndpointActionLock(tenantID: string, oicpEndpoint: OICPEndpoint, action: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OICP_ENDPOINT, `${oicpEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }
}
