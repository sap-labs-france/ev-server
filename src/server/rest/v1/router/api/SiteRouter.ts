import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import SiteService from '../../service/SiteService';
import sanitize from 'mongo-sanitize';

export default class SiteRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSites();
    this.buildRouteSite();
    this.buildRouteCreateSite();
    this.buildRouteSiteAssignUsers();
    this.buildRouteSiteUnassignUsers();
    this.buildRouteSiteGetUsers();
    this.buildRouteSetSiteAdmin();
    this.buildRouteSetSiteOwner();
    this.buildRouteUpdateSite();
    this.buildRouteDeleteSite();
    return this.router;
  }

  private buildRouteSites(): void {
    this.router.get(`/${RESTServerRoute.REST_SITES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(SiteService.handleGetSites.bind(this), ServerAction.SITES, req, res, next);
    });
  }

  private buildRouteSite(): void {
    this.router.get(`/${RESTServerRoute.REST_SITE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      void RouterUtils.handleRestServerAction(SiteService.handleGetSite.bind(this), ServerAction.SITE, req, res, next);
    });
  }

  private buildRouteCreateSite(): void {
    this.router.post(`/${RESTServerRoute.REST_SITES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(SiteService.handleCreateSite.bind(this), ServerAction.SITE_CREATE, req, res, next);
    });
  }

  private buildRouteSiteAssignUsers(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_ADD_USERS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleAssignUsersToSite.bind(this), ServerAction.ADD_USERS_TO_SITE, req, res, next);
    });
  }

  private buildRouteSiteUnassignUsers(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_REMOVE_USERS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleAssignUsersToSite.bind(this), ServerAction.REMOVE_USERS_FROM_SITE, req, res, next);
    });
  }

  private buildRouteSiteGetUsers(): void {
    this.router.get(`/${RESTServerRoute.REST_SITE_USERS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.SiteID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleGetUsers.bind(this), ServerAction.SITE_USERS, req, res, next);
    });
  }

  private buildRouteSetSiteAdmin(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_ADMIN}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleUpdateSiteUserAdmin.bind(this), ServerAction.SITE_USER_ADMIN, req, res, next);
    });
  }

  private buildRouteSetSiteOwner(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_OWNER}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleUpdateSiteOwner.bind(this), ServerAction.SITE_OWNER, req, res, next);
    });
  }

  private buildRouteUpdateSite(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleUpdateSite.bind(this), ServerAction.SITE_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteSite(): void {
    this.router.delete(`/${RESTServerRoute.REST_SITE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteService.handleDeleteSite.bind(this), ServerAction.SITE_DELETE, req, res, next);
    });
  }
}
