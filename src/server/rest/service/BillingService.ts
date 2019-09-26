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
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Billing or Pricing not active in this Tenant',
          Constants.HTTP_GENERAL_ERROR, // TODO: use a new constant
          'BillingService', 'handleSynchronizeUsers', req.user);
      }

      // Get Billing implementation from factory
      const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
      if (!billingImpl) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Billing settings are not configured',
          Constants.HTTP_GENERAL_ERROR, // TODO: use a new constant
          'BillingService', 'handleSynchronizeUsers', req.user);
      }

      // Check
      const actionsDone = {
        synchronized: 0,
        error: 0
      };
      // First step: Get not-synchronized users and push them into Billing
      const users = await UserStorage.getUsers(tenant.id, {
        'statuses': [Constants.USER_STATUS_ACTIVE], 'notSynchronizedBillingData': true
      }, { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
      const doneCustomers = [];
      if (users.count > 0) {
        // Process them
        Logging.logInfo({
          tenantID: tenant.id,
          module: 'BillingService',
          method: 'handleSynchronizeUsers', action: 'SynchronizeUsersForBilling',
          message: `${users.count} changed active user(s) are going to be synchronized with Billing`
        });
        for (const user of users.result) {
          try {
            // Update billing data for user
            const newBillingUserData = await billingImpl.synchronizeUser(user);
            if (newBillingUserData.customerID) {
              doneCustomers.push(newBillingUserData.customerID);
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
      // Second step: Get updated users/customers from Billing
      try {
        const updatedCustomers = await billingImpl.getUpdatedCustomers(doneCustomers);
        if (updatedCustomers && updatedCustomers.length > 0) {
          Logging.logInfo({
            tenantID: tenant.id,
            module: 'BillingService',
            method: 'handleSynchronizeUsers', action: 'SynchronizeUsersForBilling',
            message: `Users are going to be synchronized for ${updatedCustomers.length} changed Billing customers`
          });
          for (const updatedCustomer of updatedCustomers) {
            const billingUsers = await UserStorage.getUsers(tenant.id,
              { billingCustomer: updatedCustomer.customerID },
              Constants.DB_PARAMS_SINGLE_RECORD);
            if (billingUsers.count > 0) {
              const updatedBillingData = billingUsers.result[0].billingData;
              updatedBillingData.cardID = updatedCustomer.cardID;
              updatedBillingData.subscriptionID = updatedCustomer.subscriptionID;
              updatedBillingData.lastChangedOn = new Date();
              await UserStorage.saveUserBillingData(tenant.id, billingUsers.result[0].id, updatedBillingData);
              actionsDone.synchronized++;
            } else {
              Logging.logError({
                tenantID: tenant.id,
                source: updatedCustomer.customerID,
                action: Constants.ACTION_UPDATE,
                module: 'BillingService', method: 'handleSynchronizeUsers',
                message: 'Synchronization failed for changed customer in Billing application',
                detailedMessages: `No user exists for billing customer '${updatedCustomer.customerID}'`
              });
              actionsDone.error++;
            }
          }
        }
      } catch (error) {
        actionsDone.error++;
        Logging.logActionExceptionMessage(tenant.id, 'SynchronizeUsersForBilling', error);
      }
      res.status(HttpStatusCodes.OK).json(Object.assign(actionsDone, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

}
