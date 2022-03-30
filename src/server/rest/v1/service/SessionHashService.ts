import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
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
  public static async checkUserAndTenantValidity(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.tenant.id;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;
    try {
      // Get Tenant
      let tenant: Tenant;
      if (tenantID === Constants.DEFAULT_TENANT_ID) {
        tenant = { id: Constants.DEFAULT_TENANT_ID } as Tenant;
      } else {
        tenant = await TenantStorage.getTenant(tenantID);
      }
      if (!tenant) {
        throw new AppError({
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Tenant does not exist',
          module: MODULE_NAME,
          method: 'checkUserAndTenantValidity',
          user: req.user
        });
      }
      // Get User
      const user = await UserStorage.getUser(tenant, userID);
      if (!user) {
        throw new AppError({
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'User does not exist',
          module: MODULE_NAME,
          method: 'checkUserAndTenantValidity',
          user: req.user
        });
      }
      // Set in HTTP request
      req.user.user = user;
      req.tenant = tenant;
      // Ignore check of session hash in master tenant
      if (tenantID === Constants.DEFAULT_TENANT_ID) {
        next();
        return;
      }
      // Check User's Hash
      if (userHashID !== SessionHashService.buildUserHashID(user)) {
        throw new AppError({
          errorCode: HTTPError.USER_ACCOUNT_CHANGED,
          message: 'User has been updated and will be logged off',
          module: MODULE_NAME,
          method: 'checkUserAndTenantValidity',
          user: req.user
        });
      }
      // Check Tenant's Hash
      if (tenantHashID !== SessionHashService.buildTenantHashID(tenant)) {
        throw new AppError({
          errorCode: HTTPError.TENANT_COMPONENT_CHANGED,
          message: 'Tenant has been updated and all users will be logged off',
          module: MODULE_NAME,
          method: 'checkUserAndTenantValidity',
          user: req.user
        });
      }
      next();
    } catch (err) {
      await Logging.logActionExceptionMessageAndSendResponse(ServerAction.SESSION_HASH_SERVICE, err, req, res, next);
    }
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
