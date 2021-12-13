import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Company from '../../../../types/Company';
import { CompanyDataResult } from '../../../../types/DataResult';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import CompanyValidator from '../validator/CompanyValidator';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import { TenantComponents } from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CompanyService';

export default class CompanyService {
  public static async handleDeleteCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeleteCompany');
    // Filter
    const companyID = CompanyValidator.getInstance().validateCompanyGetReq(req.query).ID;
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, companyID, Action.DELETE, action);
    // Delete
    await CompanyStorage.deleteCompany(req.tenant, company.id);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteCompany',
      message: `Company '${company.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { company }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetCompany');
    // Filter
    const filteredRequest = CompanyValidator.getInstance().validateCompanyGetReq(req.query);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withLogo: true
      }, true);
    res.json(company);
    next();
  }

  public static async handleGetCompanyLogo(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = CompanyValidator.getInstance().validateCompanyLogoGetReq(req.query);
    // Fetch Tenant Object by Tenant ID
    const tenant = await TenantStorage.getTenant(filteredRequest.TenantID);
    UtilsService.assertObjectExists(action, tenant, `Tenant ID '${filteredRequest.TenantID}' does not exist`,
      MODULE_NAME, 'handleGetCompanyLogo', req.user);
    // Get the Logo
    const companyLogo = await CompanyStorage.getCompanyLogo(tenant, filteredRequest.ID);
    if (companyLogo?.logo) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (companyLogo.logo.startsWith('data:image/')) {
        header = companyLogo.logo.substring(5, companyLogo.logo.indexOf(';'));
        encoding = companyLogo.logo.substring(companyLogo.logo.indexOf(';') + 1, companyLogo.logo.indexOf(',')) as BufferEncoding;
        companyLogo.logo = companyLogo.logo.substring(companyLogo.logo.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(companyLogo.logo ? Buffer.from(companyLogo.logo, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetCompanies(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.COMPANY, MODULE_NAME, 'handleGetCompanies');
    // Filter
    const filteredRequest = CompanyValidator.getInstance().validateCompaniesGetReq(req.query);
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check dynamic auth
    const authorizationCompaniesFilter = await AuthorizationService.checkAndGetCompaniesAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationCompaniesFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const companies = await CompanyStorage.getCompanies(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        withSite: filteredRequest.WithSite,
        withLogo: filteredRequest.WithLogo,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        ...authorizationCompaniesFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCompaniesFilter.projectFields
    );
    // Assign projected fields
    if (authorizationCompaniesFilter.projectFields) {
      companies.projectFields = authorizationCompaniesFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addCompaniesAuthorizations(req.tenant, req.user, companies as CompanyDataResult, authorizationCompaniesFilter);
    res.json(companies);
    next();
  }

  public static async handleCreateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreateCompany');
    // Filter
    const filteredRequest = CompanyValidator.getInstance().validateCompanyCreateReq(req.body);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetCompanyAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreateCompany'
      });
    }
    // Create company
    const newCompany: Company = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Company;
    // Save
    newCompany.id = await CompanyStorage.saveCompany(req.tenant, newCompany);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCompany',
      message: `Company '${newCompany.id}' has been created successfully`,
      action: action,
      detailedMessages: { company: newCompany }
    });
    res.json(Object.assign({ id: newCompany.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdateCompany');
    // Filter
    const filteredRequest = CompanyValidator.getInstance().validateCompanyUpdateReq(req.body);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Update
    company.name = filteredRequest.name;
    company.address = filteredRequest.address;
    if (Utils.objectHasProperty(filteredRequest, 'logo')) {
      company.logo = filteredRequest.logo;
    }
    company.lastChangedBy = { 'id': req.user.id };
    company.lastChangedOn = new Date();
    // Update Company
    await CompanyStorage.saveCompany(req.tenant, company, Utils.objectHasProperty(filteredRequest, 'logo') ? true : false);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateCompany',
      message: `Company '${company.name}' has been updated successfully`,
      action: action,
      detailedMessages: { company }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
