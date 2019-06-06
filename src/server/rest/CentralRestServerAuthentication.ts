import AuthService from './service/AuthService';
import UtilsService from './service/UtilsService';

require('source-map-support').install();

export default {
  // Init Passport
  initialize() {
    return AuthService.initialize();
  },

  authenticate() {
    return AuthService.authenticate();
  },

  authService(req, res, next) {
    // Parse the action
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Context
    switch (req.method) {
      // Create Request
      case "POST":
        // Action
        switch (action) {
          // Login
          case "Login":
            // Delegate
            AuthService.handleLogIn(action, req, res, next);
            break;

          // Register User
          case "RegisterUser":
            // Delegate
            AuthService.handleRegisterUser(action, req, res, next);
            break;

          // Reset password
          case "Reset":
            // Delegate
            AuthService.handleUserPasswordReset(action, req, res, next);
            break;

          // Resend verification email
          case "ResendVerificationEmail":
            // Delegate
            AuthService.handleResendVerificationEmail(action, req, res, next);
            break;

          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;

      // Get Request
      case "GET":
        // Action
        switch (action) {
          // Log out
          case "Logout":
            // Delegate
            AuthService.handleUserLogOut(action, req, res, next);
            break;

          // End-user license agreement
          case "EndUserLicenseAgreement":
            // Delegate
            AuthService.handleGetEndUserLicenseAgreement(action, req, res, next);
            break;

          // Verify Email
          case "VerifyEmail":
            // Delegate
            AuthService.handleVerifyEmail(action, req, res, next);
            break;

          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;
    }
  }
};
