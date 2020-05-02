import { Handler, NextFunction, Request, Response } from 'express';

import AuthService from './service/AuthService';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import UtilsService from './service/UtilsService';

export default {
  // Init Passport
  initialize(): Handler {
    return AuthService.initialize();
  },

  authenticate() {
    return AuthService.authenticate();
  },

  async authService(req: Request, res: Response, next: NextFunction) {
    // Parse the action
    const action = req.params.action as ServerAction;
    // Get the tenant
    let tenantID = Constants.DEFAULT_TENANT;
    if (req.body && req.body.tenant) {
      tenantID = await AuthService.getTenantID(req.body.tenant);
    } else if (req.query && req.query.tenant) {
      tenantID = await AuthService.getTenantID(req.query.tenant);
    } else if (req.user && req.user.tenantID) {
      tenantID = req.user.tenantID;
    }
    try {
      // Check Context
      switch (req.method) {
        // Create Request
        case 'POST':
          // Action
          switch (action) {
            // Login
            case ServerAction.LOGIN:
              // Delegate
              await AuthService.handleLogIn(action, req, res, next);
              break;

            // Register User
            case ServerAction.REGISTER_USER:
              // Delegate
              await AuthService.handleRegisterUser(action, req, res, next);
              break;

            // Reset password
            case ServerAction.RESET:
              // Delegate
              await AuthService.handleUserPasswordReset(action, req, res, next);
              break;

            // Resend verification email
            case ServerAction.RESEND_VERIFICATION_MAIL:
              // Delegate
              await AuthService.handleResendVerificationEmail(action, req, res, next);
              break;

            default:
              // Delegate
              UtilsService.handleUnknownAction(action, req, res, next);
          }
          break;

        // Get Request
        case 'GET':
          // Action
          switch (action) {
            // Log out
            case ServerAction.LOGOUT:
              // Delegate
              AuthService.handleUserLogOut(action, req, res, next);
              break;

            // End-user license agreement
            case ServerAction.END_USER_LICENSE_AGREEMENT:
              // Delegate
              await AuthService.handleGetEndUserLicenseAgreement(action, req, res, next);
              break;

            // Check Eula
            case ServerAction.CHECK_END_USER_LICENSE_AGREEMENT:
              // Delegate
              await AuthService.handleCheckEndUserLicenseAgreement(action, req, res, next);
              break;

            // Verify Email
            case ServerAction.VERIFY_EMAIL:
              // Delegate
              await AuthService.handleVerifyEmail(action, req, res, next);
              break;

            default:
              // Delegate
              UtilsService.handleUnknownAction(action, req, res, next);
          }
          break;
      }
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next, tenantID);
    }
  }
};
