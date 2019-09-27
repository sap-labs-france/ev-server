import AuthService from './service/AuthService';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import UtilsService from './service/UtilsService';

export default {
  // Init Passport
  initialize() {
    return AuthService.initialize();
  },

  authenticate() {
    return AuthService.authenticate();
  },

  async authService(req, res, next) {
    // Parse the action
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);
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
            case 'Login':
              // Delegate
              await AuthService.handleLogIn(action, req, res, next);
              break;

            // Register User
            case 'RegisterUser':
              // Delegate
              await AuthService.handleRegisterUser(action, req, res, next);
              break;

            // Reset password
            case 'Reset':
              // Delegate
              await AuthService.handleUserPasswordReset(action, req, res, next);
              break;

            // Resend verification email
            case 'ResendVerificationEmail':
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
            case 'Logout':
              // Delegate
              AuthService.handleUserLogOut(action, req, res, next);
              break;

            // End-user license agreement
            case 'EndUserLicenseAgreement':
              // Delegate
              await AuthService.handleGetEndUserLicenseAgreement(action, req, res, next);
              break;

            // Check Eula
            case 'CheckEndUserLicenseAgreement':
              // Delegate
              await AuthService.handleCheckEndUserLicenseAgreement(action, req, res, next);
              break;

            // Verify Email
            case 'VerifyEmail':
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
