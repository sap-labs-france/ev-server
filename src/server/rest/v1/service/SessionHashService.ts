import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'SessionHashService';

export default class SessionHashService {
  public static async areTokenUserAndTenantStillValid(req: Request, res: Response, next: NextFunction): Promise<boolean> {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;
    try {
      // Get Tenant
      let tenant: Tenant;
      if (tenantID === Constants.DEFAULT_TENANT) {
        tenant = { id: Constants.DEFAULT_TENANT } as Tenant;
      } else {
        tenant = await TenantStorage.getTenant(tenantID);
      }
      // Get User
      const user = await UserStorage.getUser(tenant, userID);
      // User or Tenant no longer exists
      if (!tenant || !user) {
        return true;
      }
      // Set in HTTP request
      req.user.user = user;
      req.tenant = tenant;
      // No session hash in master tenant
      if (tenantID === Constants.DEFAULT_TENANT) {
        return false;
      }
      // Check User's Hash
      if (userHashID !== this.buildUserHashID(user)) {
        throw new AppError({
          errorCode: HTTPError.USER_ACCOUNT_CHANGED,
          message: 'User has been updated and will be logged off',
          module: MODULE_NAME,
          method: 'isSessionHashUpdated',
          user: req.user
        });
      }
      // Check Tenant's Hash
      if (tenantHashID !== this.buildTenantHashID(tenant)) {
        throw new AppError({
          errorCode: HTTPError.TENANT_COMPONENT_CHANGED,
          message: 'Tenant has been updated and all users will be logged off',
          module: MODULE_NAME,
          method: 'isSessionHashUpdated',
          user: req.user
        });
      }
    } catch (err) {
      // Log
      await Logging.logActionExceptionMessageAndSendResponse(ServerAction.SESSION_HASH_SERVICE, err, req, res, next);
      return true;
    }
    return false;
  }

  public static buildUserHashID(user: User): string {
    // Generate User Hash
    if (user) {
      return Utils.hash(`${Utils.getLanguageFromLocale(user.locale)}/${user.email}/${user.role}/${user.status}`);
    }
  }

  public static buildTenantHashID(tenant: Tenant): string {
    // Generate Tenant Hash
    if (tenant) {
      return Utils.hash(JSON.stringify(Utils.getTenantActiveComponents(tenant)));
    }
  }
}
