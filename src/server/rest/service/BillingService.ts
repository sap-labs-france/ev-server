import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BillingFactory from '../../../integration/billing/BillingFactory';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Utils from '../../../utils/Utils';

export default class BillingService {

  public static async handleGetBillingConnection(action: string, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_CHECK_CONNECTION_BILLING,
        entity: Constants.ENTITY_USER,
        module: 'BillingService',
        method: 'handleGetBillingConnection',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
      !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (billingImpl) {
      if (!Authorizations.canCheckConnectionBilling(req.user)) {
        throw new AppAuthError({
          errorCode: Constants.HTTP_AUTH_ERROR,
          user: req.user,
          action: Constants.ACTION_CHECK_CONNECTION_BILLING,
          entity: Constants.ENTITY_BILLING,
          module: 'BillingService',
          method: 'handleGetBillingConnection',
        });
      }
      try {
        // Check
        await billingImpl.checkConnection();
        // Ok
        res.json(Object.assign({ connectionIsValid: true }, Constants.REST_RESPONSE_SUCCESS));
      } catch (error) {
        // Ko
        Logging.logError({
          tenantID: tenant.id,
          user: req.user,
          module: 'BillingService', method: 'handleGetBillingConnection',
          message: 'Billing connection failed',
          action: action,
          detailedMessages: error
        });
        res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
      }
    } else {
      Logging.logSecurityWarning({
        tenantID: tenant.id,
        user: req.user,
        module: 'BillingService',
        method: 'handleGetBillingConnection',
        message: 'Billing (or Pricing) not active or Billing not fully implemented',
        action: action
      });
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: string, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canSynchronizeUsersBilling(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        entity: Constants.ENTITY_USER,
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
      !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    const synchronizeAction = await billingImpl.synchronizeUsers(tenant.id);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetBillingTaxes(action: string, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canReadBillingTaxes(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_READ_BILLING_TAXES,
        entity: Constants.ENTITY_USER,
        module: 'BillingService',
        method: 'handleGetBillingTaxes',
      });
    }

    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
        !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }

    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Billing settings are not configured',
        module: 'BillingService',
        method: 'handleGetBillingTaxes',
        action: action,
        user: req.user
      });
    }
    const taxes = await billingImpl.getTaxes();
    res.json(Object.assign(taxes, Constants.REST_RESPONSE_SUCCESS));
  }
}
