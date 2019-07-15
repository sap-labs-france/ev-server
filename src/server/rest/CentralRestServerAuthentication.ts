import AuthService from './service/AuthService';
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
      // FIXME: Cannot read property 'tenantID' of undefined
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next, req.user.tenantID);
    }
  }
};
