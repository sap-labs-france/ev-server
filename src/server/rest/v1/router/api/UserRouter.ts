import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import UserService from '../../service/UserService';

export default class UserRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteUsers();
    this.buildRouteUser();
    this.buildRouteCreateUser();
    this.buildRouteUpdateUser();
    this.buildRouteDeleteUser();
    this.buildRouteUserDefaultCarTag();
    this.buildRouteUserSessionContext();
    this.buildRouteUserGetSites();
    this.buildRouteUserSiteAssign();
    this.buildRouteUserSiteUnassign();
    this.buildRouteUserUpdateMobileToken();
    this.buildRouteUserUpdateMobileData();
    this.buildRouteUserGetImage();
    this.buildRouteUsersInError();
    this.buildRouteUserImport();
    this.buildRouteUserExport();
    return this.router;
  }

  private buildRouteUsers(): void {
    this.router.get(`/${RESTServerRoute.REST_USERS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleGetUsers.bind(this), ServerAction.USERS, req, res, next);
    });
  }

  private buildRouteUser(): void {
    this.router.get(`/${RESTServerRoute.REST_USER}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleGetUser.bind(this), ServerAction.USER, req, res, next);
    });
  }

  private buildRouteCreateUser(): void {
    this.router.post(`/${RESTServerRoute.REST_USERS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleCreateUser.bind(this), ServerAction.USER_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateUser(): void {
    this.router.put(`/${RESTServerRoute.REST_USER}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleUpdateUser.bind(this), ServerAction.USER_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteUser(): void {
    this.router.delete(`/${RESTServerRoute.REST_USER}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleDeleteUser.bind(this), ServerAction.USER_DELETE, req, res, next);
    });
  }

  private buildRouteUserDefaultCarTag(): void {
    this.router.get(`/${RESTServerRoute.REST_USER_DEFAULT_TAG_CAR}`, (req: Request, res: Response, next: NextFunction) => {
      // TODO: Backward compatibility issue - remove it as soon as possible
      if (!req.query.UserID) {
        // UserID was passed as an URL parameter - URL /:id/ pattern was not resolved properly client-side!
        req.query.UserID = req.params.id;
      }
      void RouterUtils.handleRestServerAction(UserService.handleGetUserDefaultTagCar.bind(this), ServerAction.USER_DEFAULT_TAG_CAR, req, res, next);
    });
  }

  private buildRouteUserSessionContext(): void {
    this.router.get(`/${RESTServerRoute.REST_USER_SESSION_CONTEXT}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.UserID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleGetUserSessionContext.bind(this), ServerAction.USER_SESSION_CONTEXT, req, res, next);
    });
  }

  private buildRouteUserGetSites(): void {
    this.router.get(`/${RESTServerRoute.REST_USER_SITES}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.UserID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleGetSites.bind(this), ServerAction.USER_SITES, req, res, next);
    });
  }

  private buildRouteUserSiteAssign(): void {
    this.router.post(`/${RESTServerRoute.REST_USER_SITES}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleAssignSitesToUser.bind(this), ServerAction.ADD_SITES_TO_USER, req, res, next);
    });
  }

  private buildRouteUserSiteUnassign(): void {
    this.router.put(`/${RESTServerRoute.REST_USER_SITES}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleAssignSitesToUser.bind(this), ServerAction.REMOVE_SITES_FROM_USER, req, res, next);
    });
  }

  // Deprecated
  private buildRouteUserUpdateMobileToken(): void {
    this.router.put(`/${RESTServerRoute.REST_USER_UPDATE_MOBILE_TOKEN}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleUpdateUserMobileData.bind(this), ServerAction.USER_UPDATE_MOBILE_DATA, req, res, next);
    });
  }

  private buildRouteUserUpdateMobileData(): void {
    this.router.put(`/${RESTServerRoute.REST_USER_UPDATE_MOBILE_DATA}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleUpdateUserMobileData.bind(this), ServerAction.USER_UPDATE_MOBILE_DATA, req, res, next);
    });
  }

  private buildRouteUserGetImage(): void {
    this.router.get(`/${RESTServerRoute.REST_USER_IMAGE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(UserService.handleGetUserImage.bind(this), ServerAction.USER_IMAGE, req, res, next);
    });
  }

  private buildRouteUsersInError(): void {
    this.router.get(`/${RESTServerRoute.REST_USERS_IN_ERROR}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleGetUsersInError.bind(this), ServerAction.USERS_IN_ERROR, req, res, next);
    });
  }

  private buildRouteUserImport(): void {
    this.router.post(`/${RESTServerRoute.REST_USERS_IMPORT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleImportUsers.bind(this), ServerAction.USERS_IMPORT, req, res, next);
    });
  }

  private buildRouteUserExport(): void {
    this.router.get(`/${RESTServerRoute.REST_USERS_EXPORT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(UserService.handleExportUsers.bind(this), ServerAction.USERS_EXPORT, req, res, next);
    });
  }
}
