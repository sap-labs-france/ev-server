import sanitize from 'mongo-sanitize';
import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BillingFactory from '../../../integration/billing/BillingFactory';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';

export default class BillingService {

  public static async handleGetBillingConnection(action: string, req: Request, res: Response, next: NextFunction) {
    const tenantID = sanitize(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (billingImpl) {
      // Check auth TODO: use another check
      if (!Authorizations.canUpdateSetting(req.user)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SETTING,
          null,
          Constants.HTTP_AUTH_ERROR,
          'BillingService', 'handleGetBillingConnection',
          req.user);
      }

      const checkResult = await billingImpl.checkConnection();

      if (checkResult.success) {
        Logging.logSecurityInfo({
          tenantID: tenantID,
          user: req.user, module: 'BillingService', method: 'handleGetBillingConnection',
          message: checkResult.message,
          action: action, detailedMessages: 'Successfully checking connection to Billing application'
        });
      } else {
        Logging.logSecurityWarning({
          tenantID: tenantID,
          user: req.user, module: 'BillingService', method: 'handleGetBillingConnection',
          message: checkResult.message,
          action: action, detailedMessages: 'Error when checking connection to Billing application'
        });
      }
      res.status(HttpStatusCodes.OK).json(Object.assign({ connectionIsValid: checkResult.success }, Constants.REST_RESPONSE_SUCCESS));
    } else {
      Logging.logSecurityWarning({
        tenantID: tenantID,
        user: req.user, module: 'BillingService', method: 'handleGetBillingConnection',
        message: 'Billing (or Pricing) not active or Billing not fully implemented',
        action: action, detailedMessages: 'Error when checking connection to Billing application'
      });
      res.status(HttpStatusCodes.OK).json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      if (!Authorizations.isAdmin(req.user)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_USER,
          null,
          Constants.HTTP_AUTH_ERROR, 'BillingService', 'handleSynchronizeUsers',
          req.user);
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
          method: 'handleSynchronizeUsers',
          action: action,
          user: req.user
        });
      }

      // Get active users (potentially only those without Stripe customer iD?)
      const users = await UserStorage.getUsers(tenant.id, {
        'statuses': [Constants.USER_STATUS_ACTIVE], 'nonSynchronizedBillingData': true
      }, { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
      // Check
      const actionsDone = {
        synchronized: 0,
        error: 0
      };
      if (users.count > 0) {
        // Process them
        Logging.logInfo({
          tenantID: tenant.id,
          module: 'BillingService',
          method: 'handleSynchronizeUsers', action: 'SynchronizeUsersForBilling',
          message: `${users.count} active user(s) are going to be synchronized for billing`
        });
        for (const user of users.result) {
          try {
            // Update billing data for user
            const newBillingUserData = await billingImpl.synchronizeUser(user);
            if (newBillingUserData.customerID) {
              await UserStorage.saveUserBillingData(tenant.id, user.id, newBillingUserData);
              actionsDone.synchronized++;
            } else {
              actionsDone.error++;
            }
          } catch (error) {
            actionsDone.error++;
            Logging.logActionExceptionMessage(tenant.id, 'SynchronizeUsersForBilling', error);
          }
        }
      }
      res.status(HttpStatusCodes.OK).json(Object.assign(actionsDone, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

}
