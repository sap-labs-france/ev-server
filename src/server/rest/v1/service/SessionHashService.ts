import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'SessionHashService';

export default class SessionHashService {
  public static async isSessionHashUpdated(req: Request, res: Response, next: NextFunction): Promise<boolean> {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;
    // No session hash in master tenant
    if (tenantID === Constants.DEFAULT_TENANT) {
      return false;
    }
    const tenant = await TenantStorage.getTenant(tenantID);
    const user = await UserStorage.getUser(tenantID, userID);
    try {
      // User or Tenant no longer exists
      if (!tenant || !user) {
        return true;
      }
      // Check User's Hash
      if (userHashID !== this.buildUserHashID(user)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: StatusCodes.FORBIDDEN,
          message: 'User has been updated and will be logged off',
          module: MODULE_NAME,
          method: 'isSessionHashUpdated',
          user: req.user
        });
      }
      // Check Tenant's Hash
      if (tenantHashID !== this.buildTenantHashID(tenant)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: StatusCodes.FORBIDDEN,
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

  public static buildUserHashID(user: User): string {
    // Generate User Hash
    if (user) {
      return Cypher.hash(`${Utils.getLanguageFromLocale(user.locale)}/${user.email}/${user.role}/${user.status}`);
    }
  }

  public static buildTenantHashID(tenant: Tenant): string {
    // Generate Tenant Hash
    if (tenant) {
      return Cypher.hash(JSON.stringify(Utils.getTenantActiveComponents(tenant)));
    }
  }
}
