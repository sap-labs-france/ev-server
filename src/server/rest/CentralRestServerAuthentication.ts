import { Action } from '../../types/Authorization';
import AuthService from './service/AuthService';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import UtilsService from './service/UtilsService';
import { Handler, NextFunction, Request, Response } from 'express';

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
    const action = /^\/\w*/g.exec(req.url)[0].substring(1) as Action;
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
            case Action.LOGIN:
              // Delegate
              await AuthService.handleLogIn(action, req, res, next);
              break;

            // Register User
            case Action.REGISTER_USER:
              // Delegate
              await AuthService.handleRegisterUser(action, req, res, next);
              break;

            // Reset password
            case Action.RESET:
              // Delegate
              await AuthService.handleUserPasswordReset(action, req, res, next);
              break;

            // Resend verification email
            case Action.RESEND_VERIFICATION_MAIL:
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
            case Action.LOGOUT:
              // Delegate
              AuthService.handleUserLogOut(action, req, res, next);
              break;

            // End-user license agreement
            case Action.END_USER_LICENSE_AGREEMENT:
              // Delegate
              await AuthService.handleGetEndUserLicenseAgreement(action, req, res, next);
              break;

            // Check Eula
            case Action.CHECK_END_USER_LICENSE_AGREEMENT:
              // Delegate
              await AuthService.handleCheckEndUserLicenseAgreement(action, req, res, next);
              break;

            // Verify Email
            case Action.VERIFY_EMAIL:
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
