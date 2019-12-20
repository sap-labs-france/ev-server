import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
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
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    };
    // Get recently updated customers from Billing application
    let userIDsChangedInBilling = await billingImpl.getUpdatedUserIDsInBilling();
    // Sync e-Mobility New Users with no billing data + e-Mobility Users that have been updated after last sync
    const usersNotSynchronized = await UserStorage.getUsers(tenant.id,
      { 'statuses': [Constants.USER_STATUS_ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (usersNotSynchronized.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${usersNotSynchronized.count} users to be synchronized in the Billing system`
      });
      for (const user of usersNotSynchronized.result) {
        try {
          // Synchronize
          let newBillingUserData;
          if (user.billingData) {
            // Update
            newBillingUserData = await billingImpl.updateUser(user);
          } else {
            // Create
            newBillingUserData = await billingImpl.createUser(user);
          }
          // Save Billing data
          await UserStorage.saveUserBillingData(tenant.id, user.id, newBillingUserData);
          actionsDone.synchronized++;
          // Log
          Logging.logInfo({
            tenantID: tenant.id,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: 'User have been synchronized successfully'
          });
          // Delete duplicate customers
          if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
            userIDsChangedInBilling = userIDsChangedInBilling.filter((id) => id !== newBillingUserData.customerID);
          }
        } catch (error) {
          actionsDone.error++;
          // Log
          Logging.logError({
            tenantID: tenant.id,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: `Synchronization error: ${error.message}`,
            detailedMessages: error
          });
        }
      }
      Logging.logInfo({
        tenantID: tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${usersNotSynchronized.count} users have been synchronized successfully in the Billing system`
      });
    }
    // Synchronize e-Mobility User's Billing data
    if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${userIDsChangedInBilling.length} e-Mobility users to be synchronized with Billing users`
      });
      for (const userIDChangedInBilling of userIDsChangedInBilling) {
        // Get Billing User
        const billingUser = await billingImpl.getUser(userIDChangedInBilling);
        if (billingUser) {
          // Get e-Mobility User
          const user = await UserStorage.getUserByEmail(tenant.id, billingUser.email);
          if (user) {
            // Update & Save
            user.billingData.customerID = billingUser.billingData.customerID;
            user.billingData.lastChangedOn = new Date();
            await UserStorage.saveUser(tenant.id, user, false);
            actionsDone.synchronized++;
            // Log
            Logging.logInfo({
              tenantID: tenant.id,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: Constants.ACTION_SYNCHRONIZE_BILLING,
              module: 'BillingService', method: 'handleSynchronizeUsers',
              message: 'User have been synchronized successfully'
            });
          } else {
            actionsDone.error++;
            // Log
            Logging.logError({
              tenantID: tenant.id,
              source: Constants.CENTRAL_SERVER,
              action: Constants.ACTION_SYNCHRONIZE_BILLING,
              module: 'BillingService', method: 'handleSynchronizeUsers',
              message: `Billing user with ID '${userIDChangedInBilling}' and email '${billingUser.email}' does not exist in e-Mobility`
            });
          }
        } else {
          actionsDone.error++;
          // Log
          Logging.logError({
            tenantID: tenant.id,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: `Billing user with ID '${userIDChangedInBilling}' does not exist`
          });
        }
      }
      Logging.logInfo({
        tenantID: tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${userIDsChangedInBilling.length} e-Mobility users have been synchronized successfully`
      });
    }
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenant.id);
    // Save last synchronization
    billingSettings.stripe.lastSynchronizedOn = new Date();
    // Save
    await SettingStorage.saveBillingSettings(tenant.id, billingSettings);
    // Ok
    res.json(Object.assign(actionsDone, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}
