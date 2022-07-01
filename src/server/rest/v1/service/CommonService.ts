import { NextFunction, Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AppError from '../../../../exception/AppError';
import AuthService from './AuthService';
import CommonValidatorRest from '../validator/CommonValidatorRest';
import { HTTPError } from '../../../../types/HTTPError';
import Tenant from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'CommonService';

export default class CommonService {

  public static async checkTenantValidity(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Methods to ignore
    if (req.url !== '/signout' &&
      req.url !== '/ping' &&
      !req.url.startsWith('/car-catalogs') &&
      !req.url.startsWith('/charging-stations/firmware/download') &&
      !req.url.startsWith('/billing/accounts') &&
      !req.url.startsWith('/eula?') &&
      req.url !== '/eula') {
      try {
        const httpRequest = {
          ...Utils.cloneObject(req.body),
          ...Utils.cloneObject(req.query)
        };
        // Get Tenant ID/Sub Domain from HTTP Request
        const filteredRequest = CommonValidatorRest.getInstance().validateAuthVerifyTenantRedirectReq(httpRequest);
        let tenantID: string;
        let tenantSubdomain: string;
        if (filteredRequest.tenant) {
          tenantSubdomain = filteredRequest.tenant;
        }
        if (filteredRequest.Tenant) {
          tenantSubdomain = filteredRequest.Tenant;
        }
        if (filteredRequest.TenantID) {
          tenantID = filteredRequest.TenantID;
        }
        if (filteredRequest.Subdomain) {
          tenantSubdomain = filteredRequest.Subdomain;
        }
        if (filteredRequest.ID && req.url.startsWith('/tenants/logo')) {
          tenantID = filteredRequest.ID;
        }
        if (!tenantID && !tenantSubdomain) {
          // Handle the default tenant
          if (Object.prototype.hasOwnProperty.call(httpRequest, 'tenant')) {
            req.tenant = await AuthService.getTenant('');
            next();
            return;
          }
          throw new AppError({
            errorCode: HTTPError.GENERAL_ERROR,
            message: 'The Tenant ID or Subdomain must be provided',
            module: MODULE_NAME,
            method: 'checkTenantValidity',
          });
        }
        // Get the Tenant
        let tenant: Tenant;
        if (tenantID) {
          tenant = await TenantStorage.getTenant(tenantID);
          if (!tenant) {
            throw new AppError({
              errorCode: StatusCodes.NOT_FOUND,
              message: `Unknown Tenant ID '${tenantID}'!`,
              module: MODULE_NAME,
              method: 'checkTenantValidity',
            });
          }
        } else {
          tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);
          if (!tenant) {
            throw new AppError({
              errorCode: StatusCodes.NOT_FOUND,
              message: `Unknown Tenant Subdomain '${tenantSubdomain}'!`,
              module: MODULE_NAME,
              method: 'checkTenantValidity',
            });
          }
        }
        // Check the redirection
        if (tenant.redirectDomain) {
          throw new AppError({
            errorCode: StatusCodes.MOVED_PERMANENTLY,
            message: ReasonPhrases.MOVED_PERMANENTLY,
            module: MODULE_NAME, method: 'checkTenantValidity',
            user: req.user,
            detailedMessages: {
              redirectDomain: tenant.redirectDomain
            }
          });
        }
        req.tenant = tenant;
        next();
      } catch (err) {
        next(err);
      }
    } else {
      next();
    }
  }
}
