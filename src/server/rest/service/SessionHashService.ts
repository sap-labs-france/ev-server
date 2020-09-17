import { NextFunction, Request, Response } from 'express';

import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import HttpStatusCodes from 'http-status-codes';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'SessionHashService';

export default class SessionHashService {
  // Check if Session has been updated and require new login
  static isSessionHashUpdated(req: Request, res: Response, next: NextFunction): boolean {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;

    try {
      // Check User's Hash
      if (global.userHashMapIDs.has(`${tenantID}#${userID}`) &&
        global.userHashMapIDs.get(`${tenantID}#${userID}`) !== userHashID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HttpStatusCodes.FORBIDDEN,
          message: 'User has been updated and will be logged off',
          module: MODULE_NAME,
          method: 'isSessionHashUpdated',
          user: req.user
        });
      }
      if (global.tenantHashMapIDs.has(`${tenantID}`) &&
        global.tenantHashMapIDs.get(`${tenantID}`) !== tenantHashID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HttpStatusCodes.FORBIDDEN,
          message: 'Tenant has been updated and all users will be logged off',
          module: MODULE_NAME,
          method: 'isSessionHashUpdated',
          user: req.user
        });
      }
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(ServerAction.SESSION_HASH_SERVICE, err, req, res, next);
      return true;
    }
    return false;
  }

  // Build User Hash ID
  static buildUserHashID(user: User): string {
    // Get all field that need to be hashed
    const tags = user.tags && user.tags.length > 0 ? user.tags.map((tag) => tag.id).sort().join('-') : '';
    const data = `${Utils.getLanguageFromLocale(user.locale)}/${user.email}/${user.role}/${user.status}/${tags}`;
    return Cypher.hash(data);
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant: Tenant): string {
    // Get all field that need to be hashed
    const data = JSON.stringify(Utils.getTenantActiveComponents(tenant));
    return Cypher.hash(data);
  }

  // Rebuild and store User Hash ID
  static async rebuildUserHashID(tenantID: string, userID: string): Promise<void> {
    // Build User hash
    const user = await UserStorage.getUser(tenantID, userID, { withTag: true });
    if (user) {
      global.userHashMapIDs.set(`${tenantID}#${userID}`, SessionHashService.buildUserHashID(user));
    } else {
      global.userHashMapIDs.delete(`${tenantID}#${userID}`);
    }
  }

  static async rebuildUserHashIDFromTagID(tenantID: string, tagID: string): Promise<void> {
    // Build User hash
    const tag = await UserStorage.getTag(tenantID, tagID);
    if (tag?.userID) {
      await this.rebuildUserHashID(tenantID, tag.userID);
    }
  }

  // Rebuild and store Tenant Hash ID
  static async rebuildTenantHashID(tenantID: string): Promise<void> {
    // Build Tenant hash
    const tenant = await TenantStorage.getTenant(tenantID);
    if (tenant) {
      global.tenantHashMapIDs.set(`${tenantID}`, SessionHashService.buildTenantHashID(tenant));
    } else {
      global.tenantHashMapIDs.delete(`${tenantID}`);
    }
  }
}
