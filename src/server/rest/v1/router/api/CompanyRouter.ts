/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CompanyService from '../../service/CompanyService';
import RouterUtils from '../RouterUtils';

export default class CompanyRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCompanies();
    this.buildRouteCompany();
    this.buildRouteCreateCompany();
    this.buildRouteUpdateCompany();
    this.buildRouteDeleteCompany();
    this.buildRouteGetCompanyLogo();
    return this.router;
  }

  protected buildRouteCompanies(): void {
    this.router.get(`/${ServerRoute.REST_COMPANIES}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CompanyService.handleGetCompanies.bind(this), ServerAction.COMPANIES, req, res, next);
    });
  }

  protected buildRouteCompany(): void {
    this.router.get(`/${ServerRoute.REST_COMPANY}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CompanyService.handleGetCompany.bind(this), ServerAction.COMPANY, req, res, next);
    });
  }

  protected buildRouteCreateCompany(): void {
    this.router.post(`/${ServerRoute.REST_COMPANIES}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CompanyService.handleCreateCompany.bind(this), ServerAction.COMPANY_CREATE, req, res, next);
    });
  }

  protected buildRouteUpdateCompany(): void {
    this.router.put(`/${ServerRoute.REST_COMPANY}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(CompanyService.handleUpdateCompany.bind(this), ServerAction.COMPANY_UPDATE, req, res, next);
    });
  }

  protected buildRouteDeleteCompany(): void {
    this.router.delete(`/${ServerRoute.REST_COMPANY}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CompanyService.handleDeleteCompany.bind(this), ServerAction.COMPANY_DELETE, req, res, next);
    });
  }

  protected buildRouteGetCompanyLogo(): void {
    this.router.get(`/${ServerRoute.REST_COMPANY_LOGO}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CompanyService.handleGetCompanyLogo.bind(this), ServerAction.COMPANY_LOGO, req, res, next);
    });
  }
}
