import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../../types/Server';

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
    this.buildRouteCheckEndUserLicenseAgreement();
    return this.router;
  }

  protected buildRouteSignIn(): void {
    this.router.post(`/${ServerAction.REST_SIGNIN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleLogIn.bind(this), ServerAction.REST_SIGNIN, req, res, next);
    });
  }

  protected buildRouteSignOn(): void {
    this.router.post(`/${ServerAction.REST_SIGNON}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleRegisterUser.bind(this), ServerAction.REST_SIGNON, req, res, next);
    });
  }

  protected buildRouteSignOut(): void {
    this.router.get(`/${ServerAction.REST_SIGNOUT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleUserLogOut.bind(this), ServerAction.REST_SIGNOUT, req, res, next);
    });
  }

  protected buildRoutePasswordReset(): void {
    this.router.post(`/password/${ServerAction.REST_RESET}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleUserPasswordReset.bind(this), ServerAction.REST_RESET, req, res, next);
    });
  }

  protected buildRouteResendVerificationMail(): void {
    this.router.post(`/mail/${ServerAction.REST_RESEND}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleResendVerificationEmail.bind(this), ServerAction.REST_RESEND, req, res, next);
    });
  }

  protected buildRouteVerifyMail(): void {
    this.router.get(`/mail/${ServerAction.REST_CHECK}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleVerifyEmail.bind(this), ServerAction.REST_CHECK, req, res, next);
    });
  }

  protected buildRouteEndUserLicenseAgreement(): void {
    this.router.get('/eula', async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleGetEndUserLicenseAgreement.bind(this), ServerAction.END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }

  protected buildRouteCheckEndUserLicenseAgreement(): void {
    this.router.get(`/eula/${ServerAction.REST_CHECK}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleCheckEndUserLicenseAgreement.bind(this), ServerAction.REST_CHECK, req, res, next);
    });
  }
}
