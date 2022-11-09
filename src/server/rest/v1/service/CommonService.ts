import { NextFunction, Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AppError from '../../../../exception/AppError';
import AuthService from './AuthService';
import CommonValidatorRest from '../validator/CommonValidatorRest';
import Tenant from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'CommonService';

export default class CommonService {

  public static async checkTenantValidity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get Tenant ID/Sub Domain from HTTP Request
      const httpRequest = {
        ...Utils.cloneObject(req.body),
        ...Utils.cloneObject(req.query)
      };
      const filteredRequest = CommonValidatorRest.getInstance().validateAuthVerifyTenantRedirectReq(httpRequest);
      // Get the Tenant information
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
      if (filteredRequest.ID && (req.url.startsWith('/tenants/logo') || req.url.startsWith('/tenants/email-logo'))) {
        tenantID = filteredRequest.ID;
      }
      // No Tenant info found
      if (!tenantID && !tenantSubdomain) {
        // Handle the default tenant
        if (Utils.objectHasProperty(httpRequest, 'tenant') || Utils.objectHasProperty(httpRequest, 'Tenant')) {
          req.tenant = await AuthService.getTenant('');
        }
        next();
        return;
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
      if (tenant?.redirectDomain) {
        throw new AppError({
          errorCode: StatusCodes.MOVED_TEMPORARILY,
          message: ReasonPhrases.MOVED_TEMPORARILY,
          module: MODULE_NAME, method: 'checkTenantValidity',
          user: req.user,
          detailedMessages: {
            redirectDomain: tenant.redirectDomain,
            subdomain: tenant.subdomain
          }
        });
      }
      req.tenant = tenant;
      next();
    } catch (err) {
      next(err);
    }
  }
}
