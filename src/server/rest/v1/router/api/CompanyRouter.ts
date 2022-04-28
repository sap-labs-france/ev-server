import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CompanyService from '../../service/CompanyService';
import RouterUtils from '../../../../../utils/RouterUtils';

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
    return this.router;
  }

  private buildRouteCompanies(): void {
    this.router.get(`/${RESTServerRoute.REST_COMPANIES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(CompanyService.handleGetCompanies.bind(this), ServerAction.COMPANIES, req, res, next);
    });
  }

  private buildRouteCompany(): void {
    this.router.get(`/${RESTServerRoute.REST_COMPANY}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(CompanyService.handleGetCompany.bind(this), ServerAction.COMPANY, req, res, next);
    });
  }

  private buildRouteCreateCompany(): void {
    this.router.post(`/${RESTServerRoute.REST_COMPANIES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(CompanyService.handleCreateCompany.bind(this), ServerAction.COMPANY_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateCompany(): void {
    this.router.put(`/${RESTServerRoute.REST_COMPANY}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(CompanyService.handleUpdateCompany.bind(this), ServerAction.COMPANY_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteCompany(): void {
    this.router.delete(`/${RESTServerRoute.REST_COMPANY}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(CompanyService.handleDeleteCompany.bind(this), ServerAction.COMPANY_DELETE, req, res, next);
    });
  }
}
