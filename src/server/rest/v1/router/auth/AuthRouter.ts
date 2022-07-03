import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class AuthRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSignIn();
    this.buildRouteSignOn();
    this.buildRouteSignOut();
    this.buildRoutePasswordReset();
    this.buildRouteVerifyMail();
    this.buildRouteResendVerificationMail();
    this.buildRouteEndUserLicenseAgreement();
    this.buildRouteEndUserLicenseAgreementHtml();
    this.buildRouteEndUserLicenseAgreementCheck();
    return this.router;
  }

  protected buildRouteSignIn(): void {
    this.router.post(`/${RESTServerRoute.REST_SIGNIN}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleLogIn.bind(this), ServerAction.LOGIN, req, res, next);
    });
  }

  protected buildRouteSignOn(): void {
    this.router.post(`/${RESTServerRoute.REST_SIGNON}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleRegisterUser.bind(this), ServerAction.REGISTER_USER, req, res, next);
    });
  }

  protected buildRouteSignOut(): void {
    this.router.get(`/${RESTServerRoute.REST_SIGNOUT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleUserLogOut.bind(this), ServerAction.LOGOUT, req, res, next);
    });
  }

  protected buildRoutePasswordReset(): void {
    this.router.post(`/${RESTServerRoute.REST_PASSWORD_RESET}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleUserPasswordReset.bind(this), ServerAction.PASSWORD_RESET, req, res, next);
    });
  }

  protected buildRouteResendVerificationMail(): void {
    this.router.post(`/${RESTServerRoute.REST_MAIL_RESEND}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleResendVerificationEmail.bind(this), ServerAction.RESEND_VERIFICATION_MAIL, req, res, next);
    });
  }

  protected buildRouteVerifyMail(): void {
    this.router.get(`/${RESTServerRoute.REST_MAIL_CHECK}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleVerifyEmail.bind(this), ServerAction.VERIFY_EMAIL, req, res, next);
    });
  }

  protected buildRouteEndUserLicenseAgreement(): void {
    this.router.get(`/${RESTServerRoute.REST_END_USER_LICENSE_AGREEMENT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleGetEndUserLicenseAgreement.bind(this), ServerAction.END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }

  protected buildRouteEndUserLicenseAgreementHtml(): void {
    this.router.get(`/${RESTServerRoute.REST_END_USER_LICENSE_AGREEMENT_HTML}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleGetEndUserLicenseAgreementHtml.bind(this), ServerAction.END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }

  protected buildRouteEndUserLicenseAgreementCheck(): void {
    this.router.get(`/${RESTServerRoute.REST_END_USER_LICENSE_AGREEMENT_CHECK}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AuthService.handleCheckEndUserLicenseAgreement.bind(this), ServerAction.CHECK_END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }
}
