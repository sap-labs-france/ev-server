import Lock, { LockEntity } from '../types/Locking';
import SiteArea from '../types/SiteArea';
import LockingManager from './LockingManager';

const MODULE_NAME = 'LockingHelper';

export default class LockingHelper {
  public static async createAndAquireExclusiveLockForSiteArea(tenantID: string, siteArea: SiteArea): Promise<Lock|null> {
    const siteAreaLock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, siteArea.id);
    if (!(await LockingManager.acquire(siteAreaLock))) {
      return null;        
    }
    return siteAreaLock;
  }
}
