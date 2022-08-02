import { NextFunction, Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import User, { UserStatus } from '../../../../types/User';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Tenant from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'SessionHashService';

export default class SessionHashService {
  public static async checkUserAndTenantValidity(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;
    try {
      // Get Tenant
      let tenant: Tenant;
      if (tenantID === Constants.DEFAULT_TENANT_ID) {
        tenant = Constants.DEFAULT_TENANT_OBJECT;
      } else {
        tenant = await TenantStorage.getTenant(tenantID);
      }
      if (!tenant) {
        throw new AppError({
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `Tenant ID '${tenant.id}' does not exist`,
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            request: req.url,
            headers: res.getHeaders(),
          }
        });
      }
      // Get User
      const user = await UserStorage.getUser(tenant, userID);
      if (!user) {
        throw new AppError({
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `User ID '${userID}' does not exist`,
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            request: req.url,
            headers: res.getHeaders(),
          }
        });
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError({
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'User is not active',
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            request: req.url,
            headers: res.getHeaders(),
          }
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
          message: 'Request rejected: User data in token is outdated',
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            request: req.url,
            headers: res.getHeaders(),
          }
        });
      }
      // Check Tenant's Hash
      if (tenantHashID !== SessionHashService.buildTenantHashID(tenant)) {
        throw new AppError({
          errorCode: HTTPError.TENANT_COMPONENT_CHANGED,
          message: 'Request rejected: Tenant data in token is outdated',
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            request: req.url,
            headers: res.getHeaders(),
          }
        });
      }
      // Check if Tenant URL has changed
      if (tenant.redirectDomain) {
        throw new AppError({
          errorCode: StatusCodes.MOVED_TEMPORARILY,
          message: ReasonPhrases.MOVED_TEMPORARILY,
          module: MODULE_NAME, method: 'checkUserAndTenantValidity',
          user: req.user,
          detailedMessages: {
            redirectDomain:tenant.redirectDomain,
            subdomain: tenant.subdomain,
            request: req.url,
            headers: res.getHeaders(),
          }
        });
      }
      next();
    } catch (err) {
      next(err);
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
